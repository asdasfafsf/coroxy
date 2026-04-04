package proxy

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"coroxy/internal/adapter"
	"coroxy/internal/constant"
	"coroxy/internal/model"

	"github.com/google/uuid"
)

// hopByHopHeaders lists headers that must not be forwarded by a proxy.
// https://www.rfc-editor.org/rfc/rfc2616#section-13.5.1
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
	logger    *slog.Logger
	transport *http.Transport
	onSession adapter.SessionCallback
	mitm      MITMProvider
}

// NewHTTPProxy creates a new HTTP forward proxy handler.
// If mitm is provided, CONNECT requests are intercepted for MITM.
func NewHTTPProxy(logger *slog.Logger, onSession adapter.SessionCallback, mitm MITMProvider) *HTTPProxy {
	return &HTTPProxy{
		logger:    logger,
		onSession: onSession,
		mitm:      mitm,
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

	start := time.Now()

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

	written, copyErr := io.Copy(w, resp.Body)
	if copyErr != nil {
		h.logger.Error("copy response body",
			slog.String("host", r.Host),
			slog.String("error", copyErr.Error()),
		)
	}

	h.captureHTTPSession(r, resp, written, start)
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

	done := make(chan struct{}, 2)
	go func() {
		defer func() { _ = clientConn.Close() }()
		defer func() { _ = targetConn.Close() }()
		_, _ = io.Copy(targetConn, clientConn)
		done <- struct{}{}
	}()

	go func() {
		defer func() { _ = targetConn.Close() }()
		defer func() { _ = clientConn.Close() }()
		_, _ = io.Copy(clientConn, targetConn)
		done <- struct{}{}
	}()

	// Wait for one direction to finish, then capture session.
	go func() {
		<-done
		h.captureTunnelSession(r, host, time.Since(start))
	}()
}

// captureHTTPSession creates a session from an HTTP request/response and notifies the callback.
func (h *HTTPProxy) captureHTTPSession(r *http.Request, resp *http.Response, bodySize int64, start time.Time) {
	if h.onSession == nil {
		return
	}

	targetHost, targetPort := splitHostPort(r.Host, 80)

	session := &model.Session{
		ID:       uuid.NewString(),
		Protocol: constant.ProtocolHTTP,
		Source:   endpointFromAddr(r.RemoteAddr),
		Target:   model.Endpoint{Host: targetHost, Port: targetPort},
		Request: &model.HTTPMessage{
			Method:  r.Method,
			URL:     r.URL.String(),
			Headers: r.Header.Clone(),
		},
		Response: &model.HTTPMessage{
			StatusCode: resp.StatusCode,
			StatusText: resp.Status,
			Headers:    resp.Header.Clone(),
			BodySize:   bodySize,
		},
		State:     constant.SessionStateCompleted,
		CreatedAt: start,
		Duration:  time.Since(start),
	}

	h.onSession(session)
}

// captureTunnelSession creates a session for a completed CONNECT tunnel.
func (h *HTTPProxy) captureTunnelSession(r *http.Request, host string, duration time.Duration) {
	if h.onSession == nil {
		return
	}

	targetHost, targetPort := splitHostPort(host, 443)

	session := &model.Session{
		ID:       uuid.NewString(),
		Protocol: constant.ProtocolTLS,
		Source:   endpointFromAddr(r.RemoteAddr),
		Target:   model.Endpoint{Host: targetHost, Port: targetPort},
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
