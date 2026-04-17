//go:build linux || windows

package cert

import (
	"crypto/x509"
	"fmt"
)

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
