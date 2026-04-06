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

	"coroxy/internal/constant"
	"coroxy/internal/model"

	"github.com/google/uuid"
)

// handleMITM performs HTTPS MITM interception on a CONNECT tunnel.
// Returns true if MITM succeeded (caller should not do anything else).
// Returns false if MITM setup failed (caller should fall back to passthrough).
func (h *HTTPProxy) handleMITM(clientConn net.Conn, host string, mitm MITMProvider) bool {
	// 1. Connect to target server via TLS to obtain original certificate.
	targetTLSConn, err := tls.DialWithDialer(
		&net.Dialer{Timeout: 30 * time.Second},
		"tcp",
		host,
		// InsecureSkipVerify is intentional: MITM proxy must connect to the target
		// regardless of its certificate validity to obtain CN/SAN for leaf cert generation.
		// The original cert's validity is not our concern — we replicate, not validate.
		&tls.Config{InsecureSkipVerify: true}, //nolint:gosec
	)
	if err != nil {
		h.logger.Warn("mitm: tls dial failed, falling back to passthrough",
			slog.String("host", host),
			slog.String("error", err.Error()),
		)
		h.captureErrorSession(host, err)
		return false
	}

	// 2. Get original server certificate for CN/SAN replication.
	state := targetTLSConn.ConnectionState()
	var originalCert *x509.Certificate
	if len(state.PeerCertificates) > 0 {
		originalCert = state.PeerCertificates[0]
	}

	// 3. Issue leaf certificate for this host.
	leafCert, err := mitm.IssueCert(hostOnly(host), originalCert)
	if err != nil {
		_ = targetTLSConn.Close()
		h.logger.Warn("mitm: issue cert failed, falling back to passthrough",
			slog.String("host", host),
			slog.String("error", err.Error()),
		)
		h.captureErrorSession(host, err)
		return false
	}

	// 4. TLS handshake with client using the leaf certificate.
	clientTLSConn := tls.Server(clientConn, &tls.Config{
		Certificates: []tls.Certificate{*leafCert},
	})
	if err := clientTLSConn.Handshake(); err != nil {
		_ = targetTLSConn.Close()
		h.logger.Warn("mitm: client handshake failed",
			slog.String("host", host),
			slog.String("error", err.Error()),
		)
		h.captureErrorSession(host, err)
		// Client rejected our cert — can't fallback, connection is broken.
		_ = clientConn.Close()
		return true
	}

	// 5. Relay decrypted HTTP traffic, capturing requests and responses.
	h.relayHTTP(clientTLSConn, targetTLSConn, host)
	_ = targetTLSConn.Close()
	_ = clientConn.Close()
	return true
}

// captureErrorSession records a failed MITM attempt as an error session.
func (h *HTTPProxy) captureErrorSession(host string, err error) {
	if h.onSession == nil {
		return
	}

	targetHost, targetPort := splitHostPort(host, 443)

	session := &model.Session{
		ID:        uuid.NewString(),
		Protocol:  constant.ProtocolTLS,
		Target:    model.Endpoint{Host: targetHost, Port: targetPort},
		State:     constant.SessionStateError,
		CreatedAt: time.Now(),
	}

	h.onSession(session)
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

		// Capture request body before forwarding.
		var reqBody []byte
		if req.Body != nil {
			reqBody, _ = readLimited(req.Body, maxCaptureSize)
			req.Body = io.NopCloser(bytes.NewReader(reqBody))
			req.ContentLength = int64(len(reqBody))
		}

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

		// Stream response to client while capturing up to maxCaptureSize for inspection.
		var captureBuf bytes.Buffer
		resp.Body = io.NopCloser(io.TeeReader(resp.Body, &limitedWriter{w: &captureBuf, remaining: maxCaptureSize}))

		if err := resp.Write(clientConn); err != nil {
			_ = resp.Body.Close()
			h.logger.Error("write response to client",
				slog.String("host", host),
				slog.String("error", err.Error()),
			)
			return
		}
		_ = resp.Body.Close()

		bodyBytes := captureBuf.Bytes()

		// Capture session.
		h.captureMITMSession(req, resp, reqBody, bodyBytes, host, start)
	}
}

// captureMITMSession creates a session from decrypted HTTPS traffic.
func (h *HTTPProxy) captureMITMSession(req *http.Request, resp *http.Response, reqBody, respBody []byte, host string, start time.Time) {
	if h.onSession == nil {
		return
	}

	targetHost, targetPort := splitHostPort(host, 443)

	elapsed := time.Since(start)
	session := &model.Session{
		ID:        uuid.NewString(),
		Protocol:  constant.ProtocolTLS,
		Source:    endpointFromAddr(req.RemoteAddr),
		Target:    model.Endpoint{Host: targetHost, Port: targetPort},
		Request:   buildRequestMessage(req, reqBody),
		Response:  buildResponseMessage(resp, respBody, int64(len(respBody))),
		Timing: &model.Timing{
			DNS:      -1,
			Connect:  -1,
			TLS:      -1,
			TTFB:     float64(elapsed.Microseconds()) / 1000.0,
			Transfer: -1,
		},
		State:     constant.SessionStateCompleted,
		CreatedAt: start,
		Duration:  elapsed,
	}

	h.onSession(session)
}

// limitedWriter writes up to a maximum number of bytes, silently discarding excess.
type limitedWriter struct {
	w         io.Writer
	remaining int64
}

func (lw *limitedWriter) Write(p []byte) (int, error) {
	if lw.remaining <= 0 {
		return len(p), nil // discard excess, report full len to avoid TeeReader error
	}
	toWrite := p
	if int64(len(p)) > lw.remaining {
		toWrite = p[:lw.remaining]
	}
	n, err := lw.w.Write(toWrite)
	lw.remaining -= int64(n)
	if err != nil {
		return n, err
	}
	return len(p), nil // report full len so TeeReader continues streaming
}

// hostOnly extracts the hostname without port.
func hostOnly(hostPort string) string {
	host, _, err := net.SplitHostPort(hostPort)
	if err != nil {
		return hostPort
	}
	return host
}
