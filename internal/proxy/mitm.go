package proxy

import (
	"coroxy/internal/cert"
)

// ProductionMITM implements MITMProvider using a real cert.Manager.
// It checks IsCAInstalled() before enabling MITM.
type ProductionMITM struct {
	manager *cert.Manager
}

// NewProductionMITM creates a MITMProvider backed by a real CA manager.
func NewProductionMITM(manager *cert.Manager) *ProductionMITM {
	return &ProductionMITM{manager: manager}
}

// ShouldIntercept returns true if the CA is installed in the OS trust store.
func (p *ProductionMITM) ShouldIntercept() bool {
	installed, _ := p.manager.IsCAInstalled()
	return installed
}

// CertManager returns the underlying cert.Manager.
func (p *ProductionMITM) CertManager() *cert.Manager {
	return p.manager
}

// TestMITM implements MITMProvider for testing.
// Always intercepts without checking OS trust store.
type TestMITM struct {
	manager *cert.Manager
}

// NewTestMITM creates a MITMProvider for tests that always intercepts.
func NewTestMITM(manager *cert.Manager) *TestMITM {
	return &TestMITM{manager: manager}
}

// ShouldIntercept always returns true in test mode.
func (t *TestMITM) ShouldIntercept() bool {
	return true
}

// CertManager returns the underlying cert.Manager.
func (t *TestMITM) CertManager() *cert.Manager {
	return t.manager
}
