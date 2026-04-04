package proxy

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync"
	"testing"
	"time"

	"coroxy/internal/adapter"
	"coroxy/internal/cert"
	"coroxy/internal/model"
)

func TestMITMCapturesHTTPSContent(t *testing.T) {
	// 1. Target HTTPS server.
	target := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Secret", "visible-via-mitm")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "decrypted body")
	}))
	defer target.Close()

	// 2. CA Manager.
	dir := t.TempDir()
	caManager, err := cert.NewManager(dir)
	if err != nil {
		t.Fatalf("NewManager: %v", err)
	}

	// 3. Session capture.
	var mu sync.Mutex
	var captured []*model.Session
	onSession := adapter.SessionCallback(func(s *model.Session) {
		mu.Lock()
		defer mu.Unlock()
		captured = append(captured, s)
	})

	// 4. Proxy with MITM.
	proxy := NewHTTPProxy(slog.Default(), onSession, NewTestMITM(caManager))
	proxyAddr := startProxyServer(t, proxy)

	// 5. Client trusts our CA.
	pool := x509.NewCertPool()
	pool.AddCert(caManager.RootCert())

	proxyURL, _ := url.Parse("http://" + proxyAddr)
	client := &http.Client{
		Transport: &http.Transport{
			Proxy: http.ProxyURL(proxyURL),
			TLSClientConfig: &tls.Config{
				RootCAs: pool,
			},
		},
		Timeout: 10 * time.Second,
	}

	// 6. Request through MITM proxy.
	resp, err := client.Get(target.URL + "/secret-path")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	body, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status: got %d, want 200", resp.StatusCode)
	}
	if string(body) != "decrypted body" {
		t.Fatalf("body: got %q, want %q", string(body), "decrypted body")
	}

	// 7. Verify session captured with decrypted content.
	mu.Lock()
	defer mu.Unlock()

	if len(captured) != 1 {
		t.Fatalf("captured: got %d, want 1", len(captured))
	}

	s := captured[0]
	if s.Protocol != "TLS" {
		t.Fatalf("protocol: got %s, want TLS", s.Protocol)
	}
	if s.Request == nil {
		t.Fatal("request: nil")
	}
	if s.Request.Method != "GET" {
		t.Fatalf("method: got %s, want GET", s.Request.Method)
	}
	if s.Response == nil {
		t.Fatal("response: nil")
	}
	if s.Response.StatusCode != 200 {
		t.Fatalf("status: got %d, want 200", s.Response.StatusCode)
	}
	if s.Response.BodySize == 0 {
		t.Fatal("body size: got 0, want > 0")
	}

	t.Logf("MITM captured: %s %s → %d (body %d bytes)",
		s.Request.Method, s.Request.URL, s.Response.StatusCode, s.Response.BodySize)
}

func TestMITMWithoutCAFallsBackToPassthrough(t *testing.T) {
	target := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "passthrough")
	}))
	defer target.Close()

	var mu sync.Mutex
	var captured []*model.Session
	onSession := adapter.SessionCallback(func(s *model.Session) {
		mu.Lock()
		defer mu.Unlock()
		captured = append(captured, s)
	})

	// No CA manager — should fall back to passthrough.
	proxy := NewHTTPProxy(slog.Default(), onSession, nil)
	proxyAddr := startProxyServer(t, proxy)

	proxyURL, _ := url.Parse("http://" + proxyAddr)
	client := &http.Client{
		Transport: &http.Transport{
			Proxy: http.ProxyURL(proxyURL),
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: true,
			},
		},
		Timeout: 10 * time.Second,
	}

	resp, err := client.Get(target.URL)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	body, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()

	if string(body) != "passthrough" {
		t.Fatalf("body: got %q, want %q", string(body), "passthrough")
	}

	client.CloseIdleConnections()
	time.Sleep(100 * time.Millisecond)

	// Passthrough should capture a tunnel session (no request/response details).
	mu.Lock()
	defer mu.Unlock()

	if len(captured) != 1 {
		t.Fatalf("captured: got %d, want 1", len(captured))
	}

	s := captured[0]
	if s.Request != nil {
		t.Fatal("passthrough should not have request details")
	}
}
