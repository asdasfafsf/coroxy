package proxy

import (
	"crypto/tls"
	"crypto/x509"

	"coroxy/internal/adapter"
)

// ProductionMITM implements MITMProvider using a CAManager.
// It checks IsCAInstalled() before enabling MITM.
type ProductionMITM struct {
	ca adapter.CAManager
}

// NewProductionMITM creates a MITMProvider backed by a real CA manager.
func NewProductionMITM(ca adapter.CAManager) *ProductionMITM {
	return &ProductionMITM{ca: ca}
}

// ShouldIntercept returns true if the CA is installed in the OS trust store.
func (p *ProductionMITM) ShouldIntercept() bool {
	installed, _ := p.ca.IsCAInstalled()
	return installed
}

// IssueCert generates a leaf certificate for the given host.
func (p *ProductionMITM) IssueCert(host string, originalCert *x509.Certificate) (*tls.Certificate, error) {
	return p.ca.IssueCert(host, originalCert)
}

// TestMITM implements MITMProvider for testing.
// Always intercepts without checking OS trust store.
type TestMITM struct {
	ca adapter.CAManager
}

// NewTestMITM creates a MITMProvider for tests that always intercepts.
func NewTestMITM(ca adapter.CAManager) *TestMITM {
	return &TestMITM{ca: ca}
}

// ShouldIntercept always returns true in test mode.
func (t *TestMITM) ShouldIntercept() bool {
	return true
}

// IssueCert generates a leaf certificate for the given host.
func (t *TestMITM) IssueCert(host string, originalCert *x509.Certificate) (*tls.Certificate, error) {
	return t.ca.IssueCert(host, originalCert)
}
