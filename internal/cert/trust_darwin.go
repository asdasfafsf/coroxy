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
func loginKeychainPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "Library", "Keychains", "login.keychain-db")
}

// installCAToDarwin installs the Root CA into the user's login keychain.
// Uses user trust domain — no admin password required.
func installCAToDarwin(certPath string) error {
	keychain := loginKeychainPath()

	// Add certificate to login keychain.
	cmd := exec.Command("security", "add-trusted-cert", "-r", "trustRoot", "-k", keychain, certPath)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("install CA: %s: %w", string(out), err)
	}
	return nil
}

// uninstallCAFromDarwin removes the Root CA from the user's login keychain.
func uninstallCAFromDarwin(certPath string) error {
	keychain := loginKeychainPath()

	// Remove certificate from login keychain.
	cmd := exec.Command("security", "remove-trusted-cert", "-k", keychain, certPath)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("uninstall CA: %s: %w", string(out), err)
	}
	return nil
}

// isCAInstalledDarwin checks if the Root CA is trusted by the OS.
func isCAInstalledDarwin(rootCA *x509.Certificate) (bool, error) {
	pool, err := x509.SystemCertPool()
	if err != nil {
		return false, fmt.Errorf("load system cert pool: %w", err)
	}

	opts := x509.VerifyOptions{
		Roots: pool,
	}

	_, err = rootCA.Verify(opts)
	return err == nil, nil
}
