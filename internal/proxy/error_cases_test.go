package proxy

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"coroxy/internal/cert"
	"coroxy/internal/model"
)

// --- HTTP Proxy error cases ---

func TestHTTPProxyTargetDNSFailure(t *testing.T) {
	proxy := NewHTTPProxy(slog.Default(), nil, nil)
	proxyAddr := startProxyServer(t, proxy)
	client := proxyClient(t, proxyAddr)

	resp, err := client.Get("http://this-domain-does-not-exist-12345.invalid/test")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// Proxy should return 502 Bad Gateway for DNS failures.
	if resp.StatusCode != http.StatusBadGateway {
		t.Fatalf("status: got %d, want 502", resp.StatusCode)
	}
}

func TestHTTPProxyLargeHeaders(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if len(r.Header.Get("X-Large")) > 1000 {
			w.WriteHeader(http.StatusOK)
			fmt.Fprint(w, "large header received")
		}
	}))
	defer target.Close()

	proxy := NewHTTPProxy(slog.Default(), nil, nil)
	proxyAddr := startProxyServer(t, proxy)
	client := proxyClient(t, proxyAddr)

	req, _ := http.NewRequest("GET", target.URL, nil)
	req.Header.Set("X-Large", strings.Repeat("A", 4096))

	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status: got %d, want 200", resp.StatusCode)
	}
}

func TestHTTPProxyTargetSlowResponse(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(100 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "slow but ok")
	}))
	defer target.Close()

	proxy := NewHTTPProxy(slog.Default(), nil, nil)
	proxyAddr := startProxyServer(t, proxy)
	client := proxyClient(t, proxyAddr)

	resp, err := client.Get(target.URL)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	body, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()

	if string(body) != "slow but ok" {
		t.Fatalf("body: got %q, want %q", string(body), "slow but ok")
	}
}

func TestHTTPProxyMultipleSequentialRequests(t *testing.T) {
	requestCount := 0
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		fmt.Fprintf(w, "request %d", requestCount)
	}))
	defer target.Close()

	proxy := NewHTTPProxy(slog.Default(), nil, nil)
	proxyAddr := startProxyServer(t, proxy)
	client := proxyClient(t, proxyAddr)

	for i := 1; i <= 5; i++ {
		resp, err := client.Get(target.URL)
		if err != nil {
			t.Fatalf("request %d: %v", i, err)
		}
		body, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()

		expected := fmt.Sprintf("request %d", i)
		if string(body) != expected {
			t.Fatalf("request %d body: got %q, want %q", i, string(body), expected)
		}
	}
}

func TestHTTPProxyEmptyBody(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent) // 204, no body
	}))
	defer target.Close()

	proxy := NewHTTPProxy(slog.Default(), nil, nil)
	proxyAddr := startProxyServer(t, proxy)
	client := proxyClient(t, proxyAddr)

	resp, err := client.Get(target.URL)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	_ = resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("status: got %d, want 204", resp.StatusCode)
	}
}

func TestHTTPProxyPOSTWithBody(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		fmt.Fprintf(w, "echo: %s", string(body))
	}))
	defer target.Close()

	proxy := NewHTTPProxy(slog.Default(), nil, nil)
	proxyAddr := startProxyServer(t, proxy)
	client := proxyClient(t, proxyAddr)

	resp, err := client.Post(target.URL, "text/plain", strings.NewReader("hello proxy"))
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	body, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()

	if string(body) != "echo: hello proxy" {
		t.Fatalf("body: got %q, want %q", string(body), "echo: hello proxy")
	}
}

// --- MITM error cases ---

func TestMITMTargetCertificatePinning(t *testing.T) {
	// Simulate pinning: client only trusts the REAL target cert, not our CA.
	target := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "should not reach")
	}))
	defer target.Close()

	caManager, _ := cert.NewManager(t.TempDir())
	proxy := NewHTTPProxy(slog.Default(), nil, NewTestMITM(caManager))
	proxyAddr := startProxyServer(t, proxy)

	// Client does NOT trust our CA — simulates certificate pinning.
	proxyURL, _ := url.Parse("http://" + proxyAddr)
	client := &http.Client{
		Transport: &http.Transport{
			Proxy:           http.ProxyURL(proxyURL),
			TLSClientConfig: &tls.Config{}, // system roots only, won't trust our CA
		},
		Timeout: 5 * time.Second,
	}

	_, err := client.Get(target.URL)
	if err == nil {
		t.Fatal("expected TLS error for pinned cert, got nil")
	}
	// This is expected — client rejects our leaf cert.
	t.Logf("Certificate pinning rejection: %v", err)
}

// --- Engine error cases ---

func TestEngineStartPortConflict(t *testing.T) {
	// Occupy a port first.
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer listener.Close()
	occupiedAddr := listener.Addr().String()

	config := model.ProxyConfig{
		HTTPAddr:  occupiedAddr, // already taken
		SOCKSAddr: "127.0.0.1:0",
	}
	engine := NewEngine(config, slog.Default(), nil, nil)

	err = engine.Start(context.Background())
	if err == nil {
		t.Fatal("expected error for port conflict, got nil")
	}
	t.Logf("Port conflict error: %v", err)

	// Engine should be in stopped state.
	if engine.State() != "stopped" {
		t.Fatalf("state: got %s, want stopped", engine.State())
	}
}

func TestEngineStartSOCKSPortConflict(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer listener.Close()

	config := model.ProxyConfig{
		HTTPAddr:  "127.0.0.1:0",
		SOCKSAddr: listener.Addr().String(), // already taken
	}
	engine := NewEngine(config, slog.Default(), nil, nil)

	err = engine.Start(context.Background())
	if err == nil {
		t.Fatal("expected error for SOCKS port conflict, got nil")
	}

	if engine.State() != "stopped" {
		t.Fatalf("state: got %s, want stopped", engine.State())
	}
}

func TestEngineRestartAfterStop(t *testing.T) {
	config := model.ProxyConfig{
		HTTPAddr:  "127.0.0.1:0",
		SOCKSAddr: "127.0.0.1:0",
	}
	engine := NewEngine(config, slog.Default(), nil, nil)

	ctx := context.Background()

	// Start → Stop → Start again.
	if err := engine.Start(ctx); err != nil {
		t.Fatalf("first start: %v", err)
	}

	stopCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := engine.Stop(stopCtx); err != nil {
		t.Fatalf("stop: %v", err)
	}

	if err := engine.Start(ctx); err != nil {
		t.Fatalf("restart: %v", err)
	}

	stopCtx2, cancel2 := context.WithTimeout(ctx, 5*time.Second)
	defer cancel2()
	if err := engine.Stop(stopCtx2); err != nil {
		t.Fatalf("stop2: %v", err)
	}
}

// --- HTTPS through Engine full path ---

func TestEngineHTTPSMITMRealTraffic(t *testing.T) {
	target := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"status":"ok","secret":"decrypted"}`)
	}))
	defer target.Close()

	caManager, _ := cert.NewManager(t.TempDir())

	config := model.ProxyConfig{
		HTTPAddr:  "127.0.0.1:0",
		SOCKSAddr: "127.0.0.1:0",
	}
	engine := NewEngine(config, slog.Default(), nil, NewTestMITM(caManager))

	ctx := context.Background()
	if err := engine.Start(ctx); err != nil {
		t.Fatalf("start: %v", err)
	}
	defer func() {
		stopCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()
		_ = engine.Stop(stopCtx)
	}()

	pool := x509.NewCertPool()
	pool.AddCert(caManager.RootCert())

	proxyURL, _ := url.Parse("http://" + engine.HTTPAddr())
	client := &http.Client{
		Transport: &http.Transport{
			Proxy:           http.ProxyURL(proxyURL),
			TLSClientConfig: &tls.Config{RootCAs: pool},
		},
		Timeout: 10 * time.Second,
	}

	resp, err := client.Get(target.URL + "/api/data")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	body, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Fatalf("status: %d", resp.StatusCode)
	}

	expected := `{"status":"ok","secret":"decrypted"}`
	if string(body) != expected {
		t.Fatalf("body: got %q, want %q", string(body), expected)
	}

	if ct := resp.Header.Get("Content-Type"); ct != "application/json" {
		t.Fatalf("content-type: got %q, want application/json", ct)
	}

	t.Log("Engine HTTPS MITM real traffic: OK")
}
