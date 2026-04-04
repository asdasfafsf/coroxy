package proxy

import (
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"
)

// hopByHopHeaders lists headers that must not be forwarded by a proxy.
// https://www.rfc-editor.org/rfc/rfc2616#section-13.5.1
var hopByHopHeaders = []string{
	"Connection",
	"Keep-Alive",
	"Proxy-Authenticate",
	"Proxy-Authorization",
	"TE",
	"Trailers",
	"Transfer-Encoding",
	"Upgrade",
}

// HTTPProxy handles HTTP forward proxy requests.
type HTTPProxy struct {
	logger    *slog.Logger
	transport *http.Transport
}

// NewHTTPProxy creates a new HTTP forward proxy handler.
func NewHTTPProxy(logger *slog.Logger) *HTTPProxy {
	return &HTTPProxy{
		logger: logger,
		transport: &http.Transport{
			DialContext:           (&net.Dialer{Timeout: 30 * time.Second}).DialContext,
			TLSHandshakeTimeout:   10 * time.Second,
			ResponseHeaderTimeout: 30 * time.Second,
			IdleConnTimeout:       90 * time.Second,
			MaxIdleConns:          100,
		},
	}
}

// ServeHTTP handles incoming proxy requests.
func (h *HTTPProxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodConnect {
		h.handleConnect(w, r)
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

	outReq := r.Clone(r.Context())
	outReq.RequestURI = ""
	removeHopByHopHeaders(outReq.Header)

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
	copyHeaders(w.Header(), resp.Header)
	w.WriteHeader(resp.StatusCode)

	if _, err := io.Copy(w, resp.Body); err != nil {
		h.logger.Error("copy response body",
			slog.String("host", r.Host),
			slog.String("error", err.Error()),
		)
	}
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

	go func() {
		defer func() { _ = clientConn.Close() }()
		defer func() { _ = targetConn.Close() }()
		_, _ = io.Copy(targetConn, clientConn)
	}()

	go func() {
		defer func() { _ = targetConn.Close() }()
		defer func() { _ = clientConn.Close() }()
		_, _ = io.Copy(clientConn, targetConn)
	}()
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

	for _, header := range hopByHopHeaders {
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
