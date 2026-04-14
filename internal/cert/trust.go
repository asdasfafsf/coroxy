package cert

import (
	"crypto/x509"
	"fmt"
	"path/filepath"
)

// InstallCA installs the Root CA into the OS trust store.
func (m *Manager) InstallCA() error {
	certPath := filepath.Join(m.dataDir, caFileName)
	return installCAPlatform(certPath)
}

// UninstallCA removes the Root CA from the OS trust store.
func (m *Manager) UninstallCA() error {
	certPath := filepath.Join(m.dataDir, caFileName)
	return uninstallCAPlatform(certPath)
}

// IsCAInstalled checks if the Root CA is trusted by the OS.
func (m *Manager) IsCAInstalled() (bool, error) {
	return isCAInstalledPlatform(m.rootCA)
}

// isCAInstalledViaSystemPool checks if the Root CA is trusted using the system cert pool.
// Used by Windows and Linux implementations.
func isCAInstalledViaSystemPool(rootCA *x509.Certificate) (bool, error) {
	pool, err := x509.SystemCertPool()
	if err != nil {
		return false, fmt.Errorf("load system cert pool: %w", err)
	}
	opts := x509.VerifyOptions{Roots: pool}
	_, err = rootCA.Verify(opts)
	return err == nil, nil
}
