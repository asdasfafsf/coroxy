package proxy

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptrace"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"coroxy/internal/adapter"
	"coroxy/internal/constant"
	"coroxy/internal/intercept"
	"coroxy/internal/model"
)

// MITMProvider abstracts the MITM capabilities needed by the HTTP proxy.
// This allows testing without OS-level CA installation.
type MITMProvider interface {
	// ShouldIntercept returns true if MITM should be active for CONNECT requests.
	ShouldIntercept() bool

	// IssueCert generates a leaf certificate for the given host,
	// copying CN/SAN from the original server certificate.
	IssueCert(host string, originalCert *x509.Certificate) (*tls.Certificate, error)
}

// HTTPProxy handles HTTP forward proxy requests.
type HTTPProxy struct {
	logger        *slog.Logger
	transport     *http.Transport
	onSession     adapter.SessionCallback
	mitm          MITMProvider
	pipeline      *intercept.Pipeline
	autoResponder *intercept.AutoResponder
}

// NewHTTPProxy creates a new HTTP forward proxy handler.
// If mitm is provided, CONNECT requests are intercepted for MITM.
func NewHTTPProxy(logger *slog.Logger, onSession adapter.SessionCallback, mitm MITMProvider, pipeline *intercept.Pipeline) *HTTPProxy {
	return &HTTPProxy{
		logger:    logger,
		onSession: onSession,
		mitm:      mitm,
		pipeline:  pipeline,
		transport: &http.Transport{
			DialContext:           (&net.Dialer{Timeout: 30 * time.Second}).DialContext,
			TLSHandshakeTimeout:   10 * time.Second,
			ResponseHeaderTimeout: 30 * time.Second,
			IdleConnTimeout:       90 * time.Second,
			MaxIdleConns:          100,
		},
	}
}

// SetAutoResponder sets the auto responder for serving canned responses.
func (h *HTTPProxy) SetAutoResponder(ar *intercept.AutoResponder) {
	h.autoResponder = ar
}

// ServeHTTP handles incoming proxy requests.
func (h *HTTPProxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodConnect {
		h.handleConnect(w, r)
		return
	}

	if h.isWebSocket(r) {
		h.handleWebSocket(w, r)
		return
	}

	h.handleHTTP(w, r)
}

// handleHTTP forwards a regular HTTP request to the target server.
func (h *HTTPProxy) handleHTTP(w http.ResponseWriter, r *http.Request) {
	if !r.URL.IsAbs() {
		http.Error(w, "proxy: absolute URL required", http.StatusBadRequest)
		return
	}

	start := time.Now()

	outReq := r.Clone(r.Context())
	outReq.RequestURI = ""
	removeHopByHopHeaders(outReq.Header)

	// Capture request body (limit to maxCaptureSize).
	var reqBody []byte
	if outReq.Body != nil {
		var readErr error
		reqBody, readErr = readLimited(outReq.Body, maxCaptureSize)
		_ = readErr // capture failure should not break proxying
		outReq.Body = io.NopCloser(bytes.NewReader(reqBody))
		outReq.ContentLength = int64(len(reqBody))
	}

	// Run interceptor pipeline on request.
	if h.pipeline != nil && h.pipeline.Count() > 0 {
		if h.pipeline.ProcessRequest(outReq, nil) == adapter.ActionDrop {
			// Check if an auto-respond rule matched.
			if ruleID := outReq.Header.Get(constant.HeaderAutoResponseRule); ruleID != "" && h.autoResponder != nil {
				if ar := h.autoResponder.FindResponse(ruleID); ar != nil {
					autoResp := intercept.BuildHTTPResponse(ar, outReq)
					for k, vs := range autoResp.Header {
						for _, v := range vs {
							w.Header().Add(k, v)
						}
					}
					w.WriteHeader(autoResp.StatusCode)
					if autoResp.Body != nil {
						_, _ = io.Copy(w, autoResp.Body)
						_ = autoResp.Body.Close()
					}
					return
				}
			}
			http.Error(w, "proxy: request dropped by interceptor", http.StatusForbidden)
			return
		}
	}

	// Attach httptrace to measure timing breakdown.
	var tt requestTiming
	traceCtx := httptrace.WithClientTrace(outReq.Context(), tt.trace())
	outReq = outReq.WithContext(traceCtx)

	resp, err := h.transport.RoundTrip(outReq)
	if err != nil {
		h.logger.Error("forward request",
			slog.String("host", r.Host),
			slog.String("error", err.Error()),
		)
		http.Error(w, "proxy: bad gateway", http.StatusBadGateway)
		return
	}
	defer func() { _ = resp.Body.Close() }()

	removeHopByHopHeaders(resp.Header)

	// Run interceptor pipeline on response.
	if h.pipeline != nil && h.pipeline.Count() > 0 {
		if h.pipeline.ProcessResponse(resp, nil) == adapter.ActionDrop {
			http.Error(w, "proxy: response dropped by interceptor", http.StatusForbidden)
			return
		}
	}

	copyHeaders(w.Header(), resp.Header)
	w.WriteHeader(resp.StatusCode)

	// Capture response body while forwarding to client.
	var respBodyBuf bytes.Buffer
	respReader := io.TeeReader(resp.Body, &limitWriter{w: &respBodyBuf, n: maxCaptureSize})

	written, copyErr := io.Copy(w, respReader)
	if copyErr != nil {
		h.logger.Error("copy response body",
			slog.String("host", r.Host),
			slog.String("error", copyErr.Error()),
		)
	}

	transferEnd := time.Now()
	timing := tt.build(transferEnd)

	h.captureHTTPSession(r, resp, reqBody, respBodyBuf.Bytes(), written, start, timing)
}

// handleConnect establishes a TCP tunnel for CONNECT requests (HTTPS passthrough).
func (h *HTTPProxy) handleConnect(w http.ResponseWriter, r *http.Request) {
	host := r.Host
	if _, _, err := net.SplitHostPort(host); err != nil {
		host = net.JoinHostPort(host, "443")
	}

	targetConn, err := net.DialTimeout("tcp", host, 30*time.Second)
	if err != nil {
		h.logger.Error("connect to target",
			slog.String("host", host),
			slog.String("error", err.Error()),
		)
		http.Error(w, "proxy: connection failed", http.StatusBadGateway)
		return
	}

	hijacker, ok := w.(http.Hijacker)
	if !ok {
		_ = targetConn.Close()
		http.Error(w, "proxy: hijack not supported", http.StatusInternalServerError)
		return
	}

	clientConn, _, err := hijacker.Hijack()
	if err != nil {
		_ = targetConn.Close()
		h.logger.Error("hijack client connection",
			slog.String("host", host),
			slog.String("error", err.Error()),
		)
		return
	}

	// Write 200 response directly to hijacked connection.
	if _, err := fmt.Fprint(clientConn, "HTTP/1.1 200 Connection Established\r\n\r\n"); err != nil {
		_ = clientConn.Close()
		_ = targetConn.Close()
		return
	}

	// MITM: only intercept if CA is installed in OS trust store.
	// If CA is not installed, passthrough to avoid certificate errors (Fiddler behavior).
	if h.mitm != nil && h.mitm.ShouldIntercept() {
		_ = targetConn.Close() // MITM handler makes its own TLS connection
		if h.handleMITM(clientConn, host, h.mitm) {
			return // MITM handled (success or client rejected cert)
		}

		// MITM setup failed (target TLS unreachable, cert issue, etc.)
		// Fall back to passthrough with a new target connection.
		var err error
		targetConn, err = net.DialTimeout("tcp", host, 30*time.Second)
		if err != nil {
			_ = clientConn.Close()
			return
		}
	}

	// Passthrough: no MITM, just relay bytes.
	start := time.Now()

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		defer recoverGoroutine(h.logger, "connect tunnel client→target")
		_, _ = io.Copy(targetConn, clientConn)
		if tc, ok := targetConn.(*net.TCPConn); ok {
			_ = tc.CloseWrite()
		}
	}()

	go func() {
		defer wg.Done()
		defer recoverGoroutine(h.logger, "connect tunnel target→client")
		_, _ = io.Copy(clientConn, targetConn)
		if tc, ok := clientConn.(*net.TCPConn); ok {
			_ = tc.CloseWrite()
		}
	}()

	// 양방향 모두 종료 후 정리.
	// handleConnect already hijacked the connection, so the HTTP handler
	// goroutine is free — safe to wait synchronously.
	wg.Wait()
	_ = clientConn.Close()
	_ = targetConn.Close()
	h.captureTunnelSession(r, host, time.Since(start))
}

// maxCaptureSize is the maximum body size to capture per request/response.
const maxCaptureSize = 32 << 20 // 32MB

// captureHTTPSession creates a session from an HTTP request/response and notifies the callback.
func (h *HTTPProxy) captureHTTPSession(r *http.Request, resp *http.Response, reqBody, respBody []byte, bodySize int64, start time.Time, timing *model.Timing) {
	if h.onSession == nil {
		return
	}

	targetHost, targetPort := splitHostPort(r.Host, 80)

	session := &model.Session{
		ID:        uuid.NewString(),
		Protocol:  constant.ProtocolHTTP,
		Source:    endpointFromAddr(r.RemoteAddr),
		Target:    model.Endpoint{Host: targetHost, Port: targetPort},
		Request:   buildRequestMessage(r, reqBody),
		Response:  buildResponseMessage(resp, respBody, bodySize),
		Timing:    timing,
		State:     constant.SessionStateCompleted,
		CreatedAt: start,
		Duration:  time.Since(start),
	}

	h.onSession(session)
}

// buildRequestMessage extracts all HTTP request data into an HTTPMessage.
func buildRequestMessage(r *http.Request, body []byte) *model.HTTPMessage {
	msg := &model.HTTPMessage{
		Method:      r.Method,
		URL:         r.URL.String(),
		HTTPVersion: r.Proto,
		Headers:     r.Header.Clone(),
		Body:        body,
		BodySize:    int64(len(body)),
		ContentType: r.Header.Get("Content-Type"),
	}

	// Parse query parameters.
	for name, values := range r.URL.Query() {
		for _, v := range values {
			msg.QueryParams = append(msg.QueryParams, model.QueryParam{Name: name, Value: v})
		}
	}

	// Parse request cookies.
	for _, c := range r.Cookies() {
		msg.Cookies = append(msg.Cookies, model.HTTPCookie{
			Name:  c.Name,
			Value: c.Value,
		})
	}

	return msg
}

// buildResponseMessage extracts all HTTP response data into an HTTPMessage.
func buildResponseMessage(resp *http.Response, body []byte, bodySize int64) *model.HTTPMessage {
	msg := &model.HTTPMessage{
		StatusCode:      resp.StatusCode,
		StatusText:      http.StatusText(resp.StatusCode),
		HTTPVersion:     resp.Proto,
		Headers:         resp.Header.Clone(),
		Body:            body,
		BodySize:        bodySize,
		ContentType:     resp.Header.Get("Content-Type"),
		ContentEncoding: resp.Header.Get("Content-Encoding"),
	}

	// Parse Set-Cookie response headers.
	for _, c := range resp.Cookies() {
		cookie := model.HTTPCookie{
			Name:     c.Name,
			Value:    c.Value,
			Domain:   c.Domain,
			Path:     c.Path,
			Secure:   c.Secure,
			HTTPOnly: c.HttpOnly,
			MaxAge:   c.MaxAge,
		}
		if !c.Expires.IsZero() {
			cookie.Expires = c.Expires.Format("2006-01-02T15:04:05Z")
		}
		switch c.SameSite {
		case http.SameSiteLaxMode:
			cookie.SameSite = "Lax"
		case http.SameSiteStrictMode:
			cookie.SameSite = "Strict"
		case http.SameSiteNoneMode:
			cookie.SameSite = "None"
		}
		msg.Cookies = append(msg.Cookies, cookie)
	}

	return msg
}

// readLimited reads up to maxBytes from r.
func readLimited(r io.Reader, maxBytes int64) ([]byte, error) {
	return io.ReadAll(io.LimitReader(r, maxBytes))
}

// limitWriter wraps an io.Writer and stops writing after n bytes.
// Always reports the full input length to avoid short-write errors in TeeReader.
type limitWriter struct {
	w io.Writer
	n int64
}

func (lw *limitWriter) Write(p []byte) (int, error) {
	if lw.n <= 0 {
		return len(p), nil // discard excess
	}
	toWrite := p
	if int64(len(p)) > lw.n {
		toWrite = p[:lw.n]
	}
	n, err := lw.w.Write(toWrite)
	lw.n -= int64(n)
	if err != nil {
		return n, err
	}
	return len(p), nil // report full len so TeeReader continues
}

// captureTunnelSession creates a session for a completed CONNECT tunnel.
func (h *HTTPProxy) captureTunnelSession(r *http.Request, host string, duration time.Duration) {
	if h.onSession == nil {
		return
	}

	targetHost, targetPort := splitHostPort(host, 443)

	session := &model.Session{
		ID:        uuid.NewString(),
		Protocol:  constant.ProtocolTLS,
		Source:    endpointFromAddr(r.RemoteAddr),
		Target:    model.Endpoint{Host: targetHost, Port: targetPort},
		State:     constant.SessionStateCompleted,
		CreatedAt: time.Now().Add(-duration),
		Duration:  duration,
	}

	h.onSession(session)
}

// splitHostPort parses host:port with a default port fallback.
func splitHostPort(addr string, defaultPort int) (string, int) {
	host, portStr, err := net.SplitHostPort(addr)
	if err != nil {
		return addr, defaultPort
	}

	port, err := strconv.Atoi(portStr)
	if err != nil {
		return host, defaultPort
	}

	return host, port
}

// endpointFromAddr parses a remote address string into an Endpoint.
func endpointFromAddr(addr string) model.Endpoint {
	host, port := splitHostPort(addr, 0)
	return model.Endpoint{Host: host, Port: port}
}

// removeHopByHopHeaders removes hop-by-hop headers from h.
// It also removes headers listed in the Connection header value.
func removeHopByHopHeaders(h http.Header) {
	// Remove headers listed in Connection before deleting Connection itself.
	if conn := h.Get("Connection"); conn != "" {
		for _, name := range strings.Split(conn, ",") {
			h.Del(strings.TrimSpace(name))
		}
	}

	for _, header := range []string{
		"Connection", "Keep-Alive", "Proxy-Authenticate", "Proxy-Authorization",
		"TE", "Trailers", "Transfer-Encoding", "Upgrade",
	} {
		h.Del(header)
	}
}

// copyHeaders copies all headers from src to dst.
func copyHeaders(dst, src http.Header) {
	for key, values := range src {
		for _, value := range values {
			dst.Add(key, value)
		}
	}
}

// requestTiming collects timestamps from httptrace hooks.
type requestTiming struct {
	dnsStart     time.Time
	dnsEnd       time.Time
	connectStart time.Time
	connectEnd   time.Time
	tlsStart     time.Time
	tlsEnd       time.Time
	gotFirstByte time.Time
	wroteRequest time.Time
}

// trace returns an httptrace.ClientTrace that populates timing fields.
func (t *requestTiming) trace() *httptrace.ClientTrace {
	return &httptrace.ClientTrace{
		DNSStart:             func(_ httptrace.DNSStartInfo) { t.dnsStart = time.Now() },
		DNSDone:              func(_ httptrace.DNSDoneInfo) { t.dnsEnd = time.Now() },
		ConnectStart:         func(_, _ string) { t.connectStart = time.Now() },
		ConnectDone:          func(_, _ string, _ error) { t.connectEnd = time.Now() },
		TLSHandshakeStart:    func() { t.tlsStart = time.Now() },
		TLSHandshakeDone:     func(_ tls.ConnectionState, _ error) { t.tlsEnd = time.Now() },
		WroteRequest:         func(_ httptrace.WroteRequestInfo) { t.wroteRequest = time.Now() },
		GotFirstResponseByte: func() { t.gotFirstByte = time.Now() },
	}
}

// build converts collected timestamps into a Timing struct (milliseconds).
func (t *requestTiming) build(transferEnd time.Time) *model.Timing {
	ms := func(d time.Duration) float64 {
		if d <= 0 {
			return -1
		}
		return float64(d.Microseconds()) / 1000.0
	}

	timing := &model.Timing{
		DNS:     -1,
		Connect: -1,
		TLS:     -1,
		TTFB:    -1,
	}

	if !t.dnsStart.IsZero() && !t.dnsEnd.IsZero() {
		timing.DNS = ms(t.dnsEnd.Sub(t.dnsStart))
	}
	if !t.connectStart.IsZero() && !t.connectEnd.IsZero() {
		timing.Connect = ms(t.connectEnd.Sub(t.connectStart))
	}
	if !t.tlsStart.IsZero() && !t.tlsEnd.IsZero() {
		timing.TLS = ms(t.tlsEnd.Sub(t.tlsStart))
	}
	if !t.wroteRequest.IsZero() && !t.gotFirstByte.IsZero() {
		timing.TTFB = ms(t.gotFirstByte.Sub(t.wroteRequest))
	}
	if !t.gotFirstByte.IsZero() {
		timing.Transfer = ms(transferEnd.Sub(t.gotFirstByte))
	}

	return timing
}
