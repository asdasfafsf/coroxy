package cert

import (
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
