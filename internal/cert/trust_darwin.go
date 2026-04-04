//go:build darwin

package cert

import (
	"crypto/x509"
	"fmt"
	"os/exec"
)

// installCAToDarwin installs the Root CA into the macOS system keychain
// using osascript to trigger a native password prompt (GUI-compatible).
func installCAToDarwin(certPath string) error {
	script := fmt.Sprintf(
		`do shell script "security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain %s" with administrator privileges`,
		certPath,
	)

	cmd := exec.Command("osascript", "-e", script)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("install CA: %s: %w", string(out), err)
	}
	return nil
}

// uninstallCAFromDarwin removes the Root CA from the macOS system keychain
// using osascript to trigger a native password prompt.
func uninstallCAFromDarwin(certPath string) error {
	script := fmt.Sprintf(
		`do shell script "security remove-trusted-cert -d %s" with administrator privileges`,
		certPath,
	)

	cmd := exec.Command("osascript", "-e", script)
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
