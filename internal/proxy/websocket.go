package proxy

import (
	"bytes"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"coroxy/internal/constant"
	"coroxy/internal/model"
)

// isWebSocketUpgrade checks if the request is a WebSocket upgrade.
func isWebSocketUpgrade(r *http.Request) bool {
	return strings.EqualFold(r.Header.Get("Upgrade"), "websocket") &&
		strings.Contains(strings.ToLower(r.Header.Get("Connection")), "upgrade")
}

// handleWebSocket upgrades the connection and relays WebSocket frames.
// Note: WebSocket frames are relayed as raw bytes without passing through
// the interceptor pipeline. Frame-level interception is not supported yet.
func (h *HTTPProxy) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Connect to the target server.
	targetAddr := r.Host
	if _, _, err := net.SplitHostPort(targetAddr); err != nil {
		targetAddr = net.JoinHostPort(targetAddr, "80")
	}

	targetConn, err := net.DialTimeout("tcp", targetAddr, 30*time.Second)
	if err != nil {
		h.logger.Error("websocket dial target",
			slog.String("host", r.Host),
			slog.String("error", err.Error()),
		)
		http.Error(w, "proxy: websocket connection failed", http.StatusBadGateway)
		return
	}

	// Forward the original HTTP upgrade request to the target.
	if err := r.Write(targetConn); err != nil {
		_ = targetConn.Close()
		h.logger.Error("websocket write upgrade",
			slog.String("host", r.Host),
			slog.String("error", err.Error()),
		)
		http.Error(w, "proxy: websocket upgrade failed", http.StatusBadGateway)
		return
	}

	// Hijack the client connection.
	hijacker, ok := w.(http.Hijacker)
	if !ok {
		_ = targetConn.Close()
		http.Error(w, "proxy: hijack not supported", http.StatusInternalServerError)
		return
	}

	clientConn, _, err := hijacker.Hijack()
	if err != nil {
		_ = targetConn.Close()
		h.logger.Error("websocket hijack",
			slog.String("host", r.Host),
			slog.String("error", err.Error()),
		)
		return
	}

	start := time.Now()

	// Capture raw bytes while relaying (same approach as TCP capture).
	var clientBuf, serverBuf bytes.Buffer
	clientCapture := &limitWriter{w: &clientBuf, n: maxWSPayloadCapture * 10}
	serverCapture := &limitWriter{w: &serverBuf, n: maxWSPayloadCapture * 10}

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		defer func() {
			if r := recover(); r != nil {
				h.logger.Error("websocket client→target relay panic", slog.Any("panic", r))
			}
		}()
		_, _ = io.Copy(io.MultiWriter(targetConn, clientCapture), clientConn)
		if tc, ok := targetConn.(*net.TCPConn); ok {
			_ = tc.CloseWrite()
		}
	}()
	go func() {
		defer wg.Done()
		defer func() {
			if r := recover(); r != nil {
				h.logger.Error("websocket target→client relay panic", slog.Any("panic", r))
			}
		}()
		_, _ = io.Copy(io.MultiWriter(clientConn, serverCapture), targetConn)
		if tc, ok := clientConn.(*net.TCPConn); ok {
			_ = tc.CloseWrite()
		}
	}()
	wg.Wait()
	_ = clientConn.Close()
	_ = targetConn.Close()

	// Parse captured bytes into WS frames.
	var frames []model.WSFrame
	frames = append(frames, parseWSFrames(clientBuf.Bytes(), "client")...)
	frames = append(frames, parseWSFrames(serverBuf.Bytes(), "server")...)
	h.captureWebSocketSessionWithFrames(r, frames, start, time.Since(start))
}

// captureWebSocketSessionWithFrames creates a session for a WebSocket connection with captured frames.
func (h *HTTPProxy) captureWebSocketSessionWithFrames(r *http.Request, frames []model.WSFrame, start time.Time, duration time.Duration) {
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
		WSFrames:  frames,
		State:     constant.SessionStateCompleted,
		CreatedAt: start,
		Duration:  duration,
	}

	h.onSession(session)
}

// isWebSocket reports whether the request is a WebSocket upgrade.
func (h *HTTPProxy) isWebSocket(r *http.Request) bool {
	return isWebSocketUpgrade(r)
}
