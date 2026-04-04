package cert

import (
	"crypto/tls"
	"crypto/x509"
	"net"
	"sync"
	"sync/atomic"
	"testing"
)

func TestIssueCertBasic(t *testing.T) {
	dir := t.TempDir()
	m, err := NewManager(dir)
	if err != nil {
		t.Fatalf("NewManager: %v", err)
	}

	cert, err := m.IssueCert("example.com", nil)
	if err != nil {
		t.Fatalf("IssueCert: %v", err)
	}

	if cert == nil {
		t.Fatal("IssueCert: got nil cert")
	}
	if len(cert.Certificate) != 2 {
		t.Fatalf("cert chain length: got %d, want 2 (leaf + root)", len(cert.Certificate))
	}

	// Parse leaf and verify.
	leaf, err := x509.ParseCertificate(cert.Certificate[0])
	if err != nil {
		t.Fatalf("parse leaf: %v", err)
	}

	if leaf.Subject.CommonName != "example.com" {
		t.Fatalf("CN: got %q, want %q", leaf.Subject.CommonName, "example.com")
	}

	if len(leaf.DNSNames) != 1 || leaf.DNSNames[0] != "example.com" {
		t.Fatalf("DNSNames: got %v, want [example.com]", leaf.DNSNames)
	}

	// Verify leaf is signed by root.
	pool := x509.NewCertPool()
	pool.AddCert(m.RootCert())
	if _, err := leaf.Verify(x509.VerifyOptions{Roots: pool}); err != nil {
		t.Fatalf("verify leaf against root: %v", err)
	}
}

func TestIssueCertWithOriginalCert(t *testing.T) {
	dir := t.TempDir()
	m, err := NewManager(dir)
	if err != nil {
		t.Fatalf("NewManager: %v", err)
	}

	original := &x509.Certificate{
		DNSNames:    []string{"*.example.com", "example.com"},
		IPAddresses: []net.IP{net.ParseIP("10.0.0.1")},
	}
	original.Subject.CommonName = "example.com"
	original.Subject.Organization = []string{"Example Inc."}

	cert, err := m.IssueCert("api.example.com", original)
	if err != nil {
		t.Fatalf("IssueCert: %v", err)
	}

	leaf, _ := x509.ParseCertificate(cert.Certificate[0])

	// Should copy SAN from original.
	if len(leaf.DNSNames) != 2 {
		t.Fatalf("DNSNames: got %v, want [*.example.com example.com]", leaf.DNSNames)
	}
	if len(leaf.IPAddresses) != 1 || !leaf.IPAddresses[0].Equal(net.ParseIP("10.0.0.1")) {
		t.Fatalf("IPAddresses: got %v, want [10.0.0.1]", leaf.IPAddresses)
	}

	// Should copy subject from original.
	if leaf.Subject.CommonName != "example.com" {
		t.Fatalf("CN: got %q, want %q", leaf.Subject.CommonName, "example.com")
	}
}

func TestIssueCertIPHost(t *testing.T) {
	dir := t.TempDir()
	m, err := NewManager(dir)
	if err != nil {
		t.Fatalf("NewManager: %v", err)
	}

	cert, err := m.IssueCert("192.168.1.1", nil)
	if err != nil {
		t.Fatalf("IssueCert: %v", err)
	}

	leaf, _ := x509.ParseCertificate(cert.Certificate[0])

	if len(leaf.IPAddresses) != 1 || !leaf.IPAddresses[0].Equal(net.ParseIP("192.168.1.1")) {
		t.Fatalf("IPAddresses: got %v, want [192.168.1.1]", leaf.IPAddresses)
	}
}

func TestIssueCertCache(t *testing.T) {
	dir := t.TempDir()
	m, err := NewManager(dir)
	if err != nil {
		t.Fatalf("NewManager: %v", err)
	}

	cert1, err := m.IssueCert("cached.example.com", nil)
	if err != nil {
		t.Fatalf("first IssueCert: %v", err)
	}

	cert2, err := m.IssueCert("cached.example.com", nil)
	if err != nil {
		t.Fatalf("second IssueCert: %v", err)
	}

	// Should be the exact same pointer (cached).
	if cert1 != cert2 {
		t.Fatal("cache miss: got different cert pointers for same host")
	}
}

func TestIssueCertConcurrent(t *testing.T) {
	dir := t.TempDir()
	m, err := NewManager(dir)
	if err != nil {
		t.Fatalf("NewManager: %v", err)
	}

	var wg sync.WaitGroup
	var certs [10]*tls.Certificate
	var errs [10]error

	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			certs[idx], errs[idx] = m.IssueCert("concurrent.example.com", nil)
		}(i)
	}

	wg.Wait()

	for i, err := range errs {
		if err != nil {
			t.Fatalf("goroutine %d: %v", i, err)
		}
	}

	// All should get the same cached cert (singleflight dedup).
	for i := 1; i < 10; i++ {
		if certs[i] != certs[0] {
			t.Fatalf("goroutine %d got different cert than goroutine 0", i)
		}
	}
}

func TestIssueCertLeafIsNotCA(t *testing.T) {
	dir := t.TempDir()
	m, err := NewManager(dir)
	if err != nil {
		t.Fatalf("NewManager: %v", err)
	}

	cert, err := m.IssueCert("leaf.example.com", nil)
	if err != nil {
		t.Fatalf("IssueCert: %v", err)
	}

	leaf, _ := x509.ParseCertificate(cert.Certificate[0])

	if leaf.IsCA {
		t.Fatal("leaf cert should not be CA")
	}

	var hasServerAuth bool
	for _, usage := range leaf.ExtKeyUsage {
		if usage == x509.ExtKeyUsageServerAuth {
			hasServerAuth = true
			break
		}
	}
	if !hasServerAuth {
		t.Fatal("leaf cert missing ServerAuth ExtKeyUsage")
	}
}

func TestIssueCertSingleflightDedup(t *testing.T) {
	dir := t.TempDir()
	m, err := NewManager(dir)
	if err != nil {
		t.Fatalf("NewManager: %v", err)
	}

	// Issue many different hosts to fill cache, verify no panics.
	var generateCount atomic.Int32
	var wg sync.WaitGroup

	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			host := "host" + string(rune('a'+idx%26)) + ".example.com"
			_, err := m.IssueCert(host, nil)
			if err != nil {
				t.Errorf("IssueCert(%s): %v", host, err)
			}
			generateCount.Add(1)
		}(i)
	}

	wg.Wait()

	if generateCount.Load() != 50 {
		t.Fatalf("expected 50 successful calls, got %d", generateCount.Load())
	}
}
