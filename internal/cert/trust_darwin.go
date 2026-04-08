//go:build darwin

package cert

import (
	"crypto/x509"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// loginKeychainPath returns the path to the user's login keychain.
func loginKeychainPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("get home dir: %w", err)
	}
	return filepath.Join(home, "Library", "Keychains", "login.keychain-db"), nil
}

// installCAPlatform installs the Root CA into the macOS login keychain.
func installCAPlatform(certPath string) error {
	keychain, err := loginKeychainPath()
	if err != nil {
		return err
	}

	cmd := exec.Command("security", "add-trusted-cert", "-r", "trustRoot", "-k", keychain, certPath)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("install ca: %s: %w", string(out), err)
	}
	return nil
}

// uninstallCAPlatform removes the Root CA from the macOS login keychain.
func uninstallCAPlatform(certPath string) error {
	keychain, err := loginKeychainPath()
	if err != nil {
		return err
	}

	cmd := exec.Command("security", "remove-trusted-cert", "-k", keychain, certPath)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("uninstall ca: %s: %w", string(out), err)
	}
	return nil
}

// isCAInstalledPlatform checks if the Root CA is trusted on macOS.
func isCAInstalledPlatform(rootCA *x509.Certificate) (bool, error) {
	pool, err := x509.SystemCertPool()
	if err != nil {
		return false, fmt.Errorf("load system cert pool: %w", err)
	}
	opts := x509.VerifyOptions{Roots: pool}
	_, err = rootCA.Verify(opts)
	return err == nil, nil
}
