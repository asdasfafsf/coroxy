package cert

import (
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestNewManagerGeneratesCA(t *testing.T) {
	dir := t.TempDir()

	m, err := NewManager(dir)
	if err != nil {
		t.Fatalf("NewManager: %v", err)
	}

	if m.RootCert() == nil {
		t.Fatal("RootCert: got nil")
	}
	if m.rootPrivateKey() == nil {
		t.Fatal("RootKey: got nil")
	}

	// Verify files created.
	if !fileExists(filepath.Join(dir, caFileName)) {
		t.Fatal("ca.crt not created")
	}
	if !fileExists(filepath.Join(dir, caKeyName)) {
		t.Fatal("ca.key not created")
	}

	// Verify key file permissions.
	info, err := os.Stat(filepath.Join(dir, caKeyName))
	if err != nil {
		t.Fatalf("stat ca.key: %v", err)
	}
	if perm := info.Mode().Perm(); perm != 0600 {
		t.Fatalf("ca.key permissions: got %o, want 0600", perm)
	}
}

func TestNewManagerLoadsExistingCA(t *testing.T) {
	dir := t.TempDir()

	// Generate CA.
	m1, err := NewManager(dir)
	if err != nil {
		t.Fatalf("first NewManager: %v", err)
	}

	fingerprint1 := m1.CAInfo().Fingerprint

	// Load same CA.
	m2, err := NewManager(dir)
	if err != nil {
		t.Fatalf("second NewManager: %v", err)
	}

	fingerprint2 := m2.CAInfo().Fingerprint

	if fingerprint1 != fingerprint2 {
		t.Fatalf("fingerprints differ: %s vs %s", fingerprint1, fingerprint2)
	}
}

func TestCAInfoFields(t *testing.T) {
	dir := t.TempDir()

	m, err := NewManager(dir)
	if err != nil {
		t.Fatalf("NewManager: %v", err)
	}

	info := m.CAInfo()

	if info.CommonName != "Coroxy Root CA" {
		t.Fatalf("CommonName: got %q, want %q", info.CommonName, "Coroxy Root CA")
	}
	if info.Fingerprint == "" {
		t.Fatal("Fingerprint: empty")
	}
	if info.CreatedAt.IsZero() {
		t.Fatal("CreatedAt: zero")
	}
	if info.ExpiresAt.IsZero() {
		t.Fatal("ExpiresAt: zero")
	}

	expectedExpiry := info.CreatedAt.AddDate(caValidYears, 0, 0)
	if info.ExpiresAt.Sub(expectedExpiry) > time.Second {
		t.Fatalf("ExpiresAt: got %v, want ~%v", info.ExpiresAt, expectedExpiry)
	}
}

func TestCAIsCA(t *testing.T) {
	dir := t.TempDir()

	m, err := NewManager(dir)
	if err != nil {
		t.Fatalf("NewManager: %v", err)
	}

	cert := m.RootCert()
	if !cert.IsCA {
		t.Fatal("IsCA: got false, want true")
	}
	if cert.KeyUsage&x509.KeyUsageCertSign == 0 {
		t.Fatal("KeyUsage: missing CertSign")
	}
}

func TestLoadCorruptedCert(t *testing.T) {
	dir := t.TempDir()

	// Write garbage cert.
	os.WriteFile(filepath.Join(dir, caFileName), []byte("not a cert"), 0644)
	os.WriteFile(filepath.Join(dir, caKeyName), []byte("not a key"), 0600)

	_, err := NewManager(dir)
	if err == nil {
		t.Fatal("expected error loading corrupted CA, got nil")
	}
}

func TestLoadMismatchedKeyPair(t *testing.T) {
	dir := t.TempDir()

	// Generate a valid CA.
	m1, err := NewManager(dir)
	if err != nil {
		t.Fatalf("first NewManager: %v", err)
	}
	_ = m1

	// Generate a different key and overwrite ca.key.
	dir2 := t.TempDir()
	m2, err := NewManager(dir2)
	if err != nil {
		t.Fatalf("second NewManager: %v", err)
	}

	// Copy m2's key to m1's directory (mismatched pair).
	keyData, _ := os.ReadFile(filepath.Join(dir2, caKeyName))
	os.WriteFile(filepath.Join(dir, caKeyName), keyData, 0600)
	_ = m2

	_, err = NewManager(dir)
	if err == nil {
		t.Fatal("expected error for mismatched key pair, got nil")
	}
}

func TestLoadExpiredCA(t *testing.T) {
	dir := t.TempDir()

	// Generate a valid CA first to get a key.
	m, err := NewManager(dir)
	if err != nil {
		t.Fatalf("NewManager: %v", err)
	}

	// Create an expired cert signed with the same key.
	expiredTemplate := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "Expired CA"},
		NotBefore:    time.Now().Add(-48 * time.Hour),
		NotAfter:     time.Now().Add(-1 * time.Hour),
		IsCA:         true,
		KeyUsage:     x509.KeyUsageCertSign,
		BasicConstraintsValid: true,
	}

	expiredDER, err := x509.CreateCertificate(rand.Reader, expiredTemplate, expiredTemplate, &m.rootPrivateKey().PublicKey, m.rootPrivateKey())
	if err != nil {
		t.Fatalf("create expired cert: %v", err)
	}

	// Overwrite ca.crt with expired cert.
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: expiredDER})
	os.WriteFile(filepath.Join(dir, caFileName), certPEM, 0644)

	// Loading should fail.
	_, err = NewManager(dir)
	if err == nil {
		t.Fatal("expected error loading expired CA, got nil")
	}
}

func TestExportCA(t *testing.T) {
	dir := t.TempDir()

	m, err := NewManager(dir)
	if err != nil {
		t.Fatalf("NewManager: %v", err)
	}

	exportPath := filepath.Join(t.TempDir(), "exported-ca.crt")
	if err := m.ExportCA(exportPath); err != nil {
		t.Fatalf("ExportCA: %v", err)
	}

	// Verify exported file is valid PEM certificate.
	data, err := os.ReadFile(exportPath)
	if err != nil {
		t.Fatalf("read exported: %v", err)
	}

	block, _ := pem.Decode(data)
	if block == nil || block.Type != "CERTIFICATE" {
		t.Fatal("exported file is not a valid PEM certificate")
	}

	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		t.Fatalf("parse exported cert: %v", err)
	}

	if cert.Subject.CommonName != "Coroxy Root CA" {
		t.Fatalf("exported CN: got %q, want %q", cert.Subject.CommonName, "Coroxy Root CA")
	}
}

func TestExportCADoesNotContainPrivateKey(t *testing.T) {
	dir := t.TempDir()

	m, err := NewManager(dir)
	if err != nil {
		t.Fatalf("NewManager: %v", err)
	}

	exportPath := filepath.Join(t.TempDir(), "exported-ca.crt")
	if err := m.ExportCA(exportPath); err != nil {
		t.Fatalf("ExportCA: %v", err)
	}

	data, err := os.ReadFile(exportPath)
	if err != nil {
		t.Fatalf("read exported: %v", err)
	}

	// Ensure no private key block in exported file.
	for rest := data; len(rest) > 0; {
		var block *pem.Block
		block, rest = pem.Decode(rest)
		if block == nil {
			break
		}
		if block.Type == "RSA PRIVATE KEY" || block.Type == "PRIVATE KEY" {
			t.Fatal("exported file contains private key")
		}
	}
}
