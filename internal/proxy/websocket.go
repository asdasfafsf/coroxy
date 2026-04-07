package proxy

import (
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

	h.captureWebSocketSession(r)

	// Relay bidirectional traffic.
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		_, _ = io.Copy(targetConn, clientConn)
		// 클라이언트→타겟 종료 시 타겟 write 종료를 알림.
		if tc, ok := targetConn.(*net.TCPConn); ok {
			_ = tc.CloseWrite()
		}
	}()
	go func() {
		defer wg.Done()
		_, _ = io.Copy(clientConn, targetConn)
		// 타겟→클라이언트 종료 시 클라이언트 write 종료를 알림.
		if tc, ok := clientConn.(*net.TCPConn); ok {
			_ = tc.CloseWrite()
		}
	}()
	wg.Wait()
	_ = clientConn.Close()
	_ = targetConn.Close()
}

// captureWebSocketSession creates a session for a WebSocket connection.
func (h *HTTPProxy) captureWebSocketSession(r *http.Request) {
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
		State:     constant.SessionStateActive,
		CreatedAt: time.Now(),
	}

	h.onSession(session)
}

// addWebSocketDetection adds WebSocket upgrade detection to handleHTTP.
func (h *HTTPProxy) isWebSocket(r *http.Request) bool {
	return isWebSocketUpgrade(r)
}
