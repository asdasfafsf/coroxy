package cert

import (
	"crypto/x509"
	"fmt"

	"github.com/smallstep/truststore"
)

// InstallCA installs the Root CA into the OS trust store and Firefox NSS.
// On macOS, this triggers a password prompt. On Windows, a UAC prompt.
func (m *Manager) InstallCA() error {
	if err := truststore.Install(m.rootCA, truststore.WithFirefox()); err != nil {
		return fmt.Errorf("install CA to trust store: %w", err)
	}
	return nil
}

// UninstallCA removes the Root CA from the OS trust store and Firefox NSS.
func (m *Manager) UninstallCA() error {
	if err := truststore.Uninstall(m.rootCA, truststore.WithFirefox()); err != nil {
		return fmt.Errorf("uninstall CA from trust store: %w", err)
	}
	return nil
}

// IsCAInstalled checks if the Root CA is trusted by the OS.
// It does this by attempting to verify the CA certificate against the system root pool.
func (m *Manager) IsCAInstalled() (bool, error) {
	pool, err := x509.SystemCertPool()
	if err != nil {
		return false, fmt.Errorf("load system cert pool: %w", err)
	}

	opts := x509.VerifyOptions{
		Roots: pool,
	}

	_, err = m.rootCA.Verify(opts)
	return err == nil, nil
}
