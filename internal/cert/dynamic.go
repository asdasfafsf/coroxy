package cert

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"fmt"
	"math/big"
	"net"
	"time"

	lru "github.com/hashicorp/golang-lru/v2"
	"golang.org/x/sync/singleflight"
)

const (
	leafKeyBits    = 2048
	leafValidDays  = 365
	certCacheSize  = 256
)

// certIssuer handles dynamic leaf certificate generation with caching.
type certIssuer struct {
	rootCA  *x509.Certificate
	rootKey *rsa.PrivateKey
	cache   *lru.Cache[string, *tls.Certificate]
	group   singleflight.Group
}

// newCertIssuer creates a new certificate issuer backed by the given Root CA.
func newCertIssuer(rootCA *x509.Certificate, rootKey *rsa.PrivateKey) (*certIssuer, error) {
	cache, err := lru.New[string, *tls.Certificate](certCacheSize)
	if err != nil {
		return nil, fmt.Errorf("create cert cache: %w", err)
	}

	return &certIssuer{
		rootCA:  rootCA,
		rootKey: rootKey,
		cache:   cache,
	}, nil
}

// issueCert generates or retrieves a cached leaf certificate for the given host.
// If originalCert is provided, its CN and SAN are copied to the leaf.
// Concurrent requests for the same host are deduplicated via singleflight.
func (ci *certIssuer) issueCert(host string, originalCert *x509.Certificate) (*tls.Certificate, error) {
	if cert, ok := ci.cache.Get(host); ok {
		return cert, nil
	}

	result, err, _ := ci.group.Do(host, func() (interface{}, error) {
		// Double-check cache after acquiring singleflight.
		if cert, ok := ci.cache.Get(host); ok {
			return cert, nil
		}

		cert, err := ci.generate(host, originalCert)
		if err != nil {
			return nil, err
		}

		ci.cache.Add(host, cert)
		return cert, nil
	})

	if err != nil {
		return nil, err
	}

	cert, ok := result.(*tls.Certificate)
	if !ok {
		return nil, fmt.Errorf("unexpected type from singleflight: %T", result)
	}
	return cert, nil
}

// generate creates a new leaf certificate for the given host.
func (ci *certIssuer) generate(host string, originalCert *x509.Certificate) (*tls.Certificate, error) {
	key, err := rsa.GenerateKey(rand.Reader, leafKeyBits)
	if err != nil {
		return nil, fmt.Errorf("generate leaf key: %w", err)
	}

	serialNumber, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		return nil, fmt.Errorf("generate serial number: %w", err)
	}

	now := time.Now()
	template := &x509.Certificate{
		SerialNumber: serialNumber,
		Subject:      ci.leafSubject(host, originalCert),
		NotBefore:    now,
		NotAfter:     now.AddDate(0, 0, leafValidDays),
		KeyUsage:     x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}

	ci.copySAN(template, host, originalCert)

	certDER, err := x509.CreateCertificate(rand.Reader, template, ci.rootCA, &key.PublicKey, ci.rootKey)
	if err != nil {
		return nil, fmt.Errorf("create leaf certificate: %w", err)
	}

	return &tls.Certificate{
		Certificate: [][]byte{certDER, ci.rootCA.Raw},
		PrivateKey:  key,
	}, nil
}

// leafSubject determines the subject for the leaf certificate.
func (ci *certIssuer) leafSubject(host string, originalCert *x509.Certificate) pkix.Name {
	if originalCert != nil {
		return originalCert.Subject
	}

	return pkix.Name{
		CommonName: host,
	}
}

// copySAN copies Subject Alternative Names from the original certificate.
// If no original cert, uses the host as the only SAN.
func (ci *certIssuer) copySAN(template *x509.Certificate, host string, originalCert *x509.Certificate) {
	if originalCert != nil && (len(originalCert.DNSNames) > 0 || len(originalCert.IPAddresses) > 0) {
		template.DNSNames = originalCert.DNSNames
		template.IPAddresses = originalCert.IPAddresses
		return
	}

	if ip := net.ParseIP(host); ip != nil {
		template.IPAddresses = []net.IP{ip}
	} else {
		template.DNSNames = []string{host}
	}
}
