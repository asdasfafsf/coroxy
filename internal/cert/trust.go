package cert

import (
	"fmt"
	"path/filepath"
	"runtime"
)

// InstallCA installs the Root CA into the OS trust store.
// On macOS, this triggers a native password dialog via osascript.
func (m *Manager) InstallCA() error {
	certPath := filepath.Join(m.dataDir, caFileName)

	switch runtime.GOOS {
	case "darwin":
		return installCAToDarwin(certPath)
	default:
		return fmt.Errorf("CA installation not supported on %s", runtime.GOOS)
	}
}

// UninstallCA removes the Root CA from the OS trust store.
func (m *Manager) UninstallCA() error {
	certPath := filepath.Join(m.dataDir, caFileName)

	switch runtime.GOOS {
	case "darwin":
		return uninstallCAFromDarwin(certPath)
	default:
		return fmt.Errorf("CA uninstallation not supported on %s", runtime.GOOS)
	}
}

// IsCAInstalled checks if the Root CA is trusted by the OS.
func (m *Manager) IsCAInstalled() (bool, error) {
	switch runtime.GOOS {
	case "darwin":
		return isCAInstalledDarwin(m.rootCA)
	default:
		return false, fmt.Errorf("CA status check not supported on %s", runtime.GOOS)
	}
}
