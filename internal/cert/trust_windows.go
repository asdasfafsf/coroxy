//go:build windows

package cert

import (
	"crypto/x509"
	"fmt"
	"os/exec"
)

// installCAPlatform installs the Root CA into the Windows certificate store.
func installCAPlatform(certPath string) error {
	out, err := exec.Command("certutil", "-addstore", "Root", certPath).CombinedOutput()
	if err != nil {
		return fmt.Errorf("install ca: %s: %w", string(out), err)
	}
	return nil
}

// uninstallCAPlatform removes the Root CA from the Windows certificate store.
func uninstallCAPlatform(certPath string) error {
	out, err := exec.Command("certutil", "-delstore", "Root", certPath).CombinedOutput()
	if err != nil {
		return fmt.Errorf("uninstall ca: %s: %w", string(out), err)
	}
	return nil
}

// isCAInstalledPlatform checks if the Root CA is trusted on Windows.
func isCAInstalledPlatform(rootCA *x509.Certificate) (bool, error) {
	return isCAInstalledViaSystemPool(rootCA)
}
