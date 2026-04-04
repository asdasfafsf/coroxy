package cert

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"time"

	"coroxy/internal/model"
)

const (
	caFileName   = "ca.crt"
	caKeyName    = "ca.key"
	caKeyBits    = 3072
	caValidYears = 3
)

// Manager manages Root CA generation, loading, storage, and leaf certificate issuance.
type Manager struct {
	dataDir string
	rootCA  *x509.Certificate
	rootKey *rsa.PrivateKey
	issuer  *certIssuer
}

// NewManager creates a CA Manager. It loads an existing CA from dataDir
// or generates a new one if none exists.
func NewManager(dataDir string) (*Manager, error) {
	if err := os.MkdirAll(dataDir, 0700); err != nil {
		return nil, fmt.Errorf("create data dir %s: %w", dataDir, err)
	}

	m := &Manager{dataDir: dataDir}

	certPath := filepath.Join(dataDir, caFileName)
	keyPath := filepath.Join(dataDir, caKeyName)

	if fileExists(certPath) && fileExists(keyPath) {
		if err := m.load(); err != nil {
			return nil, fmt.Errorf("load existing CA: %w", err)
		}
	} else {
		if err := m.generate(); err != nil {
			return nil, fmt.Errorf("generate new CA: %w", err)
		}
	}

	issuer, err := newCertIssuer(m.rootCA, m.rootKey)
	if err != nil {
		return nil, fmt.Errorf("create cert issuer: %w", err)
	}
	m.issuer = issuer

	return m, nil
}

// CAInfo returns metadata about the Root CA.
func (m *Manager) CAInfo() model.CAInfo {
	fingerprint := sha256.Sum256(m.rootCA.Raw)

	installed, _ := m.IsCAInstalled()

	return model.CAInfo{
		CommonName:  m.rootCA.Subject.CommonName,
		Fingerprint: fmt.Sprintf("%x", fingerprint),
		CreatedAt:   m.rootCA.NotBefore,
		ExpiresAt:   m.rootCA.NotAfter,
		Installed:   installed,
	}
}

// IssueCert generates a leaf certificate for the given host.
// If originalCert is provided, its CN and SAN are copied.
func (m *Manager) IssueCert(host string, originalCert *x509.Certificate) (*tls.Certificate, error) {
	return m.issuer.issueCert(host, originalCert)
}

// RootCert returns the Root CA certificate.
func (m *Manager) RootCert() *x509.Certificate {
	return m.rootCA
}

// rootPrivateKey returns the Root CA private key. Internal use only.
func (m *Manager) rootPrivateKey() *rsa.PrivateKey {
	return m.rootKey
}

// ExportCA copies the Root CA certificate (not the private key) to the given path.
func (m *Manager) ExportCA(path string) error {
	src := filepath.Join(m.dataDir, caFileName)
	data, err := os.ReadFile(src)
	if err != nil {
		return fmt.Errorf("read CA cert: %w", err)
	}

	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("write CA cert to %s: %w", path, err)
	}

	return nil
}

// generate creates a new self-signed Root CA and saves it to disk.
func (m *Manager) generate() error {
	key, err := rsa.GenerateKey(rand.Reader, caKeyBits)
	if err != nil {
		return fmt.Errorf("generate RSA key: %w", err)
	}

	serialNumber, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		return fmt.Errorf("generate serial number: %w", err)
	}

	now := time.Now()
	template := &x509.Certificate{
		SerialNumber: serialNumber,
		Subject: pkix.Name{
			CommonName:   "Coroxy Root CA",
			Organization: []string{"Coroxy"},
		},
		NotBefore:             now,
		NotAfter:              now.AddDate(caValidYears, 0, 0),
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign,
		BasicConstraintsValid: true,
		IsCA:                  true,
		MaxPathLen:            0,
		MaxPathLenZero:        true,
	}

	certDER, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		return fmt.Errorf("create CA certificate: %w", err)
	}

	cert, err := x509.ParseCertificate(certDER)
	if err != nil {
		return fmt.Errorf("parse created certificate: %w", err)
	}

	if err := m.saveCert(certDER); err != nil {
		return err
	}
	if err := m.saveKey(key); err != nil {
		return err
	}

	m.rootCA = cert
	m.rootKey = key

	return nil
}

// load reads and validates an existing CA from disk.
func (m *Manager) load() error {
	certPEM, err := os.ReadFile(filepath.Join(m.dataDir, caFileName))
	if err != nil {
		return fmt.Errorf("read CA cert: %w", err)
	}

	keyPEM, err := os.ReadFile(filepath.Join(m.dataDir, caKeyName))
	if err != nil {
		return fmt.Errorf("read CA key: %w", err)
	}

	certBlock, _ := pem.Decode(certPEM)
	if certBlock == nil || certBlock.Type != "CERTIFICATE" {
		return fmt.Errorf("invalid CA cert PEM")
	}

	cert, err := x509.ParseCertificate(certBlock.Bytes)
	if err != nil {
		return fmt.Errorf("parse CA cert: %w", err)
	}

	keyBlock, _ := pem.Decode(keyPEM)
	if keyBlock == nil || keyBlock.Type != "RSA PRIVATE KEY" {
		return fmt.Errorf("invalid CA key PEM")
	}

	key, err := x509.ParsePKCS1PrivateKey(keyBlock.Bytes)
	if err != nil {
		return fmt.Errorf("parse CA key: %w", err)
	}

	// Validate key pair matches certificate.
	rsaPub, ok := cert.PublicKey.(*rsa.PublicKey)
	if !ok {
		return fmt.Errorf("CA cert has non-RSA public key")
	}
	if key.PublicKey.N.Cmp(rsaPub.N) != 0 {
		return fmt.Errorf("CA cert and key do not match")
	}

	// Check expiration.
	if time.Now().After(cert.NotAfter) {
		return fmt.Errorf("CA cert expired at %s", cert.NotAfter.Format(time.RFC3339))
	}

	m.rootCA = cert
	m.rootKey = key

	return nil
}

// saveCert writes the CA certificate to disk in PEM format.
func (m *Manager) saveCert(certDER []byte) (err error) {
	path := filepath.Join(m.dataDir, caFileName)
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		return fmt.Errorf("create CA cert file: %w", err)
	}
	defer func() {
		if cErr := f.Close(); cErr != nil && err == nil {
			err = fmt.Errorf("close CA cert file: %w", cErr)
		}
	}()

	return pem.Encode(f, &pem.Block{Type: "CERTIFICATE", Bytes: certDER})
}

// saveKey writes the CA private key to disk in PEM format with restricted permissions.
func (m *Manager) saveKey(key *rsa.PrivateKey) (err error) {
	path := filepath.Join(m.dataDir, caKeyName)
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return fmt.Errorf("create CA key file: %w", err)
	}
	defer func() {
		if cErr := f.Close(); cErr != nil && err == nil {
			err = fmt.Errorf("close CA key file: %w", cErr)
		}
	}()

	return pem.Encode(f, &pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)})
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
