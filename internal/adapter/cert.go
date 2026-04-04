package adapter

import (
	"crypto/tls"
	"crypto/x509"

	"coroxy/internal/model"
)

// CAManager defines the interface for managing CA certificates and issuing leaf certs.
type CAManager interface {
	// IssueCert generates a leaf certificate for the given host,
	// copying CN/SAN from the original server certificate.
	IssueCert(host string, originalCert *x509.Certificate) (*tls.Certificate, error)

	// InstallCA installs the Root CA into the OS trust store and Firefox NSS.
	InstallCA() error

	// UninstallCA removes the Root CA from the OS trust store and Firefox NSS.
	UninstallCA() error

	// IsCAInstalled checks if the Root CA is installed in the OS trust store.
	IsCAInstalled() (bool, error)

	// CAInfo returns metadata about the Root CA.
	CAInfo() model.CAInfo

	// ExportCA exports the Root CA certificate (not the private key) to the given path.
	ExportCA(path string) error
}
