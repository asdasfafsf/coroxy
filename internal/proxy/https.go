package proxy

import (
	"bufio"
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"io"
	"log/slog"
	"net"
	"net/http"
	"time"

	"coroxy/internal/cert"
	"coroxy/internal/constant"
	"coroxy/internal/model"

	"github.com/google/uuid"
)

// handleMITM performs HTTPS MITM interception on a CONNECT tunnel.
// It connects to the target server via TLS, obtains the original certificate,
// generates a leaf certificate, and establishes a TLS connection with the client.
// The decrypted HTTP traffic is then captured as sessions.
func (h *HTTPProxy) handleMITM(clientConn net.Conn, host string, caManager *cert.Manager) {
	defer func() { _ = clientConn.Close() }()

	// 1. Connect to target server via TLS to obtain original certificate.
	targetTLSConn, err := tls.DialWithDialer(
		&net.Dialer{Timeout: 30 * time.Second},
		"tcp",
		host,
		&tls.Config{InsecureSkipVerify: true},
	)
	if err != nil {
		h.logger.Error("tls dial target",
			slog.String("host", host),
			slog.String("error", err.Error()),
		)
		return
	}
	defer func() { _ = targetTLSConn.Close() }()

	// 2. Get original server certificate for CN/SAN replication.
	state := targetTLSConn.ConnectionState()
	var originalCert *x509.Certificate
	if len(state.PeerCertificates) > 0 {
		originalCert = state.PeerCertificates[0]
	}

	// 3. Issue leaf certificate for this host.
	leafCert, err := caManager.IssueCert(hostOnly(host), originalCert)
	if err != nil {
		h.logger.Error("issue leaf cert",
			slog.String("host", host),
			slog.String("error", err.Error()),
		)
		return
	}

	// 4. TLS handshake with client using the leaf certificate.
	clientTLSConn := tls.Server(clientConn, &tls.Config{
		Certificates: []tls.Certificate{*leafCert},
	})
	if err := clientTLSConn.Handshake(); err != nil {
		h.logger.Error("client tls handshake",
			slog.String("host", host),
			slog.String("error", err.Error()),
		)
		return
	}

	// 5. Relay decrypted HTTP traffic, capturing requests and responses.
	h.relayHTTP(clientTLSConn, targetTLSConn, host)
}

// relayHTTP reads HTTP requests from the client, forwards them to the target,
// and captures the traffic as sessions.
func (h *HTTPProxy) relayHTTP(clientConn, targetConn net.Conn, host string) {
	clientReader := bufio.NewReader(clientConn)
	targetReader := bufio.NewReader(targetConn)

	for {
		start := time.Now()

		req, err := http.ReadRequest(clientReader)
		if err != nil {
			return // connection closed or read error
		}

		// Set the full URL for the outgoing request.
		req.URL.Scheme = "https"
		req.URL.Host = host
		req.RequestURI = ""
		removeHopByHopHeaders(req.Header)

		// Forward to target.
		if err := req.Write(targetConn); err != nil {
			h.logger.Error("write to target",
				slog.String("host", host),
				slog.String("error", err.Error()),
			)
			return
		}

		// Read response from target.
		resp, err := http.ReadResponse(targetReader, req)
		if err != nil {
			h.logger.Error("read response from target",
				slog.String("host", host),
				slog.String("error", err.Error()),
			)
			return
		}

		removeHopByHopHeaders(resp.Header)

		// Read response body for capture.
		bodyBytes, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()

		// Replace body so resp.Write sends the full content.
		resp.Body = io.NopCloser(bytes.NewReader(bodyBytes))
		resp.ContentLength = int64(len(bodyBytes))

		if err := resp.Write(clientConn); err != nil {
			h.logger.Error("write response to client",
				slog.String("host", host),
				slog.String("error", err.Error()),
			)
			return
		}

		// Capture session.
		h.captureMITMSession(req, resp, int64(len(bodyBytes)), host, start)
	}
}

// captureMITMSession creates a session from decrypted HTTPS traffic.
func (h *HTTPProxy) captureMITMSession(req *http.Request, resp *http.Response, bodySize int64, host string, start time.Time) {
	if h.onSession == nil {
		return
	}

	targetHost, targetPort := splitHostPort(host, 443)

	session := &model.Session{
		ID:       uuid.NewString(),
		Protocol: constant.ProtocolTLS,
		Source:   endpointFromAddr(req.RemoteAddr),
		Target:   model.Endpoint{Host: targetHost, Port: targetPort},
		Request: &model.HTTPMessage{
			Method:  req.Method,
			URL:     req.URL.String(),
			Headers: req.Header.Clone(),
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

// hostOnly extracts the hostname without port.
func hostOnly(hostPort string) string {
	host, _, err := net.SplitHostPort(hostPort)
	if err != nil {
		return hostPort
	}
	return host
}
