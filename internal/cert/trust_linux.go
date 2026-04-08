//go:build linux

package cert

import (
	"crypto/x509"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// installCAPlatform installs the Root CA into the Linux system trust store.
func installCAPlatform(certPath string) error {
	// Try Debian/Ubuntu path first.
	debianDir := "/usr/local/share/ca-certificates"
	if _, err := os.Stat(debianDir); err == nil {
		dest := filepath.Join(debianDir, "coroxy-ca.crt")
		data, err := os.ReadFile(certPath)
		if err != nil {
			return fmt.Errorf("read ca cert: %w", err)
		}
		if err := os.WriteFile(dest, data, 0644); err != nil {
			return fmt.Errorf("write ca to trust store: %w", err)
		}
		out, err := exec.Command("update-ca-certificates").CombinedOutput()
		if err != nil {
			return fmt.Errorf("update-ca-certificates: %s: %w", string(out), err)
		}
		return nil
	}

	// Try RHEL/Fedora path.
	rhelDir := "/etc/pki/ca-trust/source/anchors"
	if _, err := os.Stat(rhelDir); err == nil {
		dest := filepath.Join(rhelDir, "coroxy-ca.crt")
		data, err := os.ReadFile(certPath)
		if err != nil {
			return fmt.Errorf("read ca cert: %w", err)
		}
		if err := os.WriteFile(dest, data, 0644); err != nil {
			return fmt.Errorf("write ca to trust store: %w", err)
		}
		out, err := exec.Command("update-ca-trust").CombinedOutput()
		if err != nil {
			return fmt.Errorf("update-ca-trust: %s: %w", string(out), err)
		}
		return nil
	}

	return fmt.Errorf("no supported ca trust store found")
}

// uninstallCAPlatform removes the Root CA from the Linux system trust store.
func uninstallCAPlatform(_ string) error {
	debianPath := "/usr/local/share/ca-certificates/coroxy-ca.crt"
	if _, err := os.Stat(debianPath); err == nil {
		if err := os.Remove(debianPath); err != nil {
			return fmt.Errorf("remove ca: %w", err)
		}
		out, err := exec.Command("update-ca-certificates", "--fresh").CombinedOutput()
		if err != nil {
			return fmt.Errorf("update-ca-certificates: %s: %w", string(out), err)
		}
		return nil
	}

	rhelPath := "/etc/pki/ca-trust/source/anchors/coroxy-ca.crt"
	if _, err := os.Stat(rhelPath); err == nil {
		if err := os.Remove(rhelPath); err != nil {
			return fmt.Errorf("remove ca: %w", err)
		}
		out, err := exec.Command("update-ca-trust").CombinedOutput()
		if err != nil {
			return fmt.Errorf("update-ca-trust: %s: %w", string(out), err)
		}
		return nil
	}

	return fmt.Errorf("no installed ca found")
}

// isCAInstalledPlatform checks if the Root CA is trusted on Linux.
func isCAInstalledPlatform(rootCA *x509.Certificate) (bool, error) {
	return isCAInstalledViaSystemPool(rootCA)
}
