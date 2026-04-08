package proxy

import (
	"bufio"
	"fmt"
	"io"
	"net"
	"net/http"
	"sync"
	"testing"
	"time"

	"coroxy/internal/adapter"
	"coroxy/internal/constant"
	"coroxy/internal/model"
)

// startWebSocketEchoServer starts a minimal WebSocket echo server.
// It accepts the upgrade and echoes all data back until the client closes.
func startWebSocketEchoServer(t *testing.T) string {
	t.Helper()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}

	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			go func(c net.Conn) {
				defer func() { _ = c.Close() }()

				// Read the HTTP upgrade request.
				req, err := http.ReadRequest(bufio.NewReader(c))
				if err != nil {
					return
				}
				_ = req.Body.Close()

				// Send 101 Switching Protocols response.
				resp := "HTTP/1.1 101 Switching Protocols\r\n" +
					"Upgrade: websocket\r\n" +
					"Connection: Upgrade\r\n\r\n"
				if _, err := c.Write([]byte(resp)); err != nil {
					return
				}

				// Echo loop.
				_, _ = io.Copy(c, c)
			}(conn)
		}
	}()

	t.Cleanup(func() { _ = listener.Close() })

	return listener.Addr().String()
}

// dialThroughProxy establishes a connection through the HTTP proxy
// and sends a WebSocket upgrade request.
func dialThroughProxy(t *testing.T, proxyAddr, targetAddr string) net.Conn {
	t.Helper()

	conn, err := net.DialTimeout("tcp", proxyAddr, 5*time.Second)
	if err != nil {
		t.Fatalf("dial proxy: %v", err)
	}

	// Send the WebSocket upgrade request through the proxy.
	upgradeReq := fmt.Sprintf(
		"GET http://%s/ HTTP/1.1\r\n"+
			"Host: %s\r\n"+
			"Upgrade: websocket\r\n"+
			"Connection: Upgrade\r\n"+
			"Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"+
			"Sec-WebSocket-Version: 13\r\n\r\n",
		targetAddr, targetAddr,
	)
	if _, err := conn.Write([]byte(upgradeReq)); err != nil {
		_ = conn.Close()
		t.Fatalf("write upgrade: %v", err)
	}

	// Read the 101 response.
	reader := bufio.NewReader(conn)
	resp, err := http.ReadResponse(reader, nil)
	if err != nil {
		_ = conn.Close()
		t.Fatalf("read upgrade response: %v", err)
	}
	_ = resp.Body.Close()

	if resp.StatusCode != http.StatusSwitchingProtocols {
		_ = conn.Close()
		t.Fatalf("upgrade status: got %d, want 101", resp.StatusCode)
	}

	return conn
}

func TestWebSocketUpgradeAndEcho(t *testing.T) {
	target := startWebSocketEchoServer(t)
	proxy := newTestHTTPProxy(t)
	proxyAddr := startProxyServer(t, proxy)

	conn := dialThroughProxy(t, proxyAddr, target)
	defer func() { _ = conn.Close() }()

	// Send data and verify echo.
	msg := []byte("hello websocket")
	if _, err := conn.Write(msg); err != nil {
		t.Fatalf("write: %v", err)
	}

	buf := make([]byte, len(msg))
	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	n, err := io.ReadFull(conn, buf)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if string(buf[:n]) != "hello websocket" {
		t.Fatalf("echo: got %q, want %q", string(buf[:n]), "hello websocket")
	}
}

func TestWebSocketSessionCapture(t *testing.T) {
	target := startWebSocketEchoServer(t)

	var mu sync.Mutex
	var captured []*model.Session
	onSession := adapter.SessionCallback(func(s *model.Session) {
		mu.Lock()
		defer mu.Unlock()
		captured = append(captured, s)
	})

	proxy := newTestHTTPProxyWithCallback(t, onSession)
	proxyAddr := startProxyServer(t, proxy)

	conn := dialThroughProxy(t, proxyAddr, target)

	// Send some data then close.
	_, _ = conn.Write([]byte("test"))
	buf := make([]byte, 4)
	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, _ = io.ReadFull(conn, buf)
	_ = conn.Close()

	// Wait for session capture.
	time.Sleep(100 * time.Millisecond)

	mu.Lock()
	defer mu.Unlock()

	if len(captured) == 0 {
		t.Fatal("no session captured")
	}

	s := captured[0]
	if s.Protocol != constant.ProtocolHTTP {
		t.Fatalf("protocol: got %s, want HTTP", s.Protocol)
	}
	if s.State != constant.SessionStateCompleted {
		t.Fatalf("state: got %s, want completed", s.State)
	}
	if s.Request == nil {
		t.Fatal("request should not be nil")
	}
	if s.Request.Method != "GET" {
		t.Fatalf("method: got %s, want GET", s.Request.Method)
	}
}

func TestWebSocketTargetUnreachable(t *testing.T) {
	proxy := newTestHTTPProxy(t)
	proxyAddr := startProxyServer(t, proxy)

	conn, err := net.DialTimeout("tcp", proxyAddr, 5*time.Second)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer func() { _ = conn.Close() }()

	// Send upgrade to a non-existent target.
	upgradeReq := "GET http://127.0.0.1:1/ HTTP/1.1\r\n" +
		"Host: 127.0.0.1:1\r\n" +
		"Upgrade: websocket\r\n" +
		"Connection: Upgrade\r\n\r\n"
	_, _ = conn.Write([]byte(upgradeReq))

	// Should get a 502 Bad Gateway.
	reader := bufio.NewReader(conn)
	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	resp, err := http.ReadResponse(reader, nil)
	if err != nil {
		t.Fatalf("read response: %v", err)
	}
	_ = resp.Body.Close()

	if resp.StatusCode != http.StatusBadGateway {
		t.Fatalf("status: got %d, want 502", resp.StatusCode)
	}
}

func TestIsWebSocketUpgrade(t *testing.T) {
	tests := []struct {
		name    string
		headers map[string]string
		want    bool
	}{
		{
			name:    "valid upgrade",
			headers: map[string]string{"Upgrade": "websocket", "Connection": "Upgrade"},
			want:    true,
		},
		{
			name:    "case insensitive",
			headers: map[string]string{"Upgrade": "WebSocket", "Connection": "upgrade"},
			want:    true,
		},
		{
			name:    "missing upgrade header",
			headers: map[string]string{"Connection": "Upgrade"},
			want:    false,
		},
		{
			name:    "missing connection header",
			headers: map[string]string{"Upgrade": "websocket"},
			want:    false,
		},
		{
			name:    "wrong upgrade value",
			headers: map[string]string{"Upgrade": "h2c", "Connection": "Upgrade"},
			want:    false,
		},
		{
			name:    "empty headers",
			headers: map[string]string{},
			want:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, _ := http.NewRequest("GET", "http://example.com", nil)
			for k, v := range tt.headers {
				req.Header.Set(k, v)
			}
			got := isWebSocketUpgrade(req)
			if got != tt.want {
				t.Fatalf("isWebSocketUpgrade: got %v, want %v", got, tt.want)
			}
		})
	}
}
