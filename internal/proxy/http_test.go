package proxy

import (
	"crypto/tls"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync"
	"testing"
	"time"

	"coroxy/internal/adapter"
	"coroxy/internal/constant"
	"coroxy/internal/model"
)

func newTestHTTPProxy(t *testing.T) *HTTPProxy {
	t.Helper()
	return NewHTTPProxy(slog.Default(), nil)
}

func newTestHTTPProxyWithCallback(t *testing.T, cb adapter.SessionCallback) *HTTPProxy {
	t.Helper()
	return NewHTTPProxy(slog.Default(), cb)
}

func startProxyServer(t *testing.T, handler http.Handler) string {
	t.Helper()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}

	server := &http.Server{Handler: handler}
	go func() { _ = server.Serve(listener) }()

	t.Cleanup(func() { _ = server.Close() })

	return listener.Addr().String()
}

func proxyClient(t *testing.T, proxyAddr string) *http.Client {
	t.Helper()

	proxyURL, err := url.Parse("http://" + proxyAddr)
	if err != nil {
		t.Fatalf("parse proxy url: %v", err)
	}

	return &http.Client{
		Transport: &http.Transport{
			Proxy:           http.ProxyURL(proxyURL),
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
		Timeout: 10 * time.Second,
	}
}

func TestHTTPProxyForward(t *testing.T) {
	// Start a target HTTP server.
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Test", "ok")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "hello from target")
	}))
	defer target.Close()

	// Start proxy.
	proxy := newTestHTTPProxy(t)
	proxyAddr := startProxyServer(t, proxy)
	client := proxyClient(t, proxyAddr)

	resp, err := client.Get(target.URL + "/test")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status: got %d, want %d", resp.StatusCode, http.StatusOK)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}

	if string(body) != "hello from target" {
		t.Fatalf("body: got %q, want %q", string(body), "hello from target")
	}

	if got := resp.Header.Get("X-Test"); got != "ok" {
		t.Fatalf("X-Test header: got %q, want %q", got, "ok")
	}
}

func TestHTTPProxyHopByHopHeaders(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify hop-by-hop headers were removed from the forwarded request.
		if got := r.Header.Get("Proxy-Authorization"); got != "" {
			t.Errorf("Proxy-Authorization should be removed, got %q", got)
		}
		if got := r.Header.Get("Connection"); got != "" {
			t.Errorf("Connection should be removed, got %q", got)
		}
		w.Header().Set("Keep-Alive", "timeout=5")
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	proxy := newTestHTTPProxy(t)
	proxyAddr := startProxyServer(t, proxy)

	req, err := http.NewRequest(http.MethodGet, target.URL, nil)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Proxy-Authorization", "Basic secret")
	req.Header.Set("Connection", "keep-alive")

	client := proxyClient(t, proxyAddr)
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("do: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// Verify hop-by-hop headers were removed from the response.
	if got := resp.Header.Get("Keep-Alive"); got != "" {
		t.Errorf("response Keep-Alive should be removed, got %q", got)
	}
}

func TestHTTPProxyNonAbsoluteURL(t *testing.T) {
	proxy := newTestHTTPProxy(t)
	proxyAddr := startProxyServer(t, proxy)

	// Send a request with a relative URL directly to the proxy.
	resp, err := http.Get("http://" + proxyAddr + "/relative-path")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status: got %d, want %d", resp.StatusCode, http.StatusBadRequest)
	}
}

func TestHTTPProxyConnectTunnel(t *testing.T) {
	// Start a TLS target server.
	target := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "hello from tls target")
	}))
	defer target.Close()

	proxy := newTestHTTPProxy(t)
	proxyAddr := startProxyServer(t, proxy)
	client := proxyClient(t, proxyAddr)

	resp, err := client.Get(target.URL)
	if err != nil {
		t.Fatalf("get via connect: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}

	if string(body) != "hello from tls target" {
		t.Fatalf("body: got %q, want %q", string(body), "hello from tls target")
	}
}

func TestHTTPProxyConnectTargetUnreachable(t *testing.T) {
	proxy := newTestHTTPProxy(t)
	proxyAddr := startProxyServer(t, proxy)

	// Try CONNECT to a non-existent host.
	client := proxyClient(t, proxyAddr)
	_, err := client.Get("https://127.0.0.1:1/unreachable")
	if err == nil {
		t.Fatal("expected error connecting to unreachable target, got nil")
	}
}

func TestHTTPProxyTargetServerError(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprint(w, "server error")
	}))
	defer target.Close()

	proxy := newTestHTTPProxy(t)
	proxyAddr := startProxyServer(t, proxy)
	client := proxyClient(t, proxyAddr)

	resp, err := client.Get(target.URL)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusInternalServerError {
		t.Fatalf("status: got %d, want %d", resp.StatusCode, http.StatusInternalServerError)
	}
}

func TestHTTPProxySessionCapture(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "captured")
	}))
	defer target.Close()

	var mu sync.Mutex
	var captured []*model.Session

	cb := func(s *model.Session) {
		mu.Lock()
		defer mu.Unlock()
		captured = append(captured, s)
	}

	proxy := newTestHTTPProxyWithCallback(t, cb)
	proxyAddr := startProxyServer(t, proxy)
	client := proxyClient(t, proxyAddr)

	resp, err := client.Get(target.URL + "/test")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	_ = resp.Body.Close()

	mu.Lock()
	defer mu.Unlock()

	if len(captured) != 1 {
		t.Fatalf("captured sessions: got %d, want 1", len(captured))
	}

	s := captured[0]
	if s.Protocol != constant.ProtocolHTTP {
		t.Fatalf("protocol: got %s, want HTTP", s.Protocol)
	}
	if s.Request == nil {
		t.Fatal("request: got nil")
	}
	if s.Request.Method != "GET" {
		t.Fatalf("method: got %s, want GET", s.Request.Method)
	}
	if s.Response == nil {
		t.Fatal("response: got nil")
	}
	if s.Response.StatusCode != 200 {
		t.Fatalf("status code: got %d, want 200", s.Response.StatusCode)
	}
}

func TestHTTPProxyConnectSessionCapture(t *testing.T) {
	target := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "tls captured")
	}))
	defer target.Close()

	var mu sync.Mutex
	var captured []*model.Session

	cb := func(s *model.Session) {
		mu.Lock()
		defer mu.Unlock()
		captured = append(captured, s)
	}

	proxy := newTestHTTPProxyWithCallback(t, cb)
	proxyAddr := startProxyServer(t, proxy)
	client := proxyClient(t, proxyAddr)

	resp, err := client.Get(target.URL)
	if err != nil {
		t.Fatalf("get via connect: %v", err)
	}
	_ = resp.Body.Close()

	mu.Lock()
	defer mu.Unlock()

	if len(captured) != 1 {
		t.Fatalf("captured sessions: got %d, want 1", len(captured))
	}

	s := captured[0]
	if s.Protocol != constant.ProtocolTLS {
		t.Fatalf("protocol: got %s, want TLS", s.Protocol)
	}
}
