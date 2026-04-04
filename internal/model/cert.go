package model

import "time"

// CAInfo holds metadata about the Root CA certificate.
type CAInfo struct {
	CommonName  string    `json:"common_name"`
	Fingerprint string    `json:"fingerprint"`
	CreatedAt   time.Time `json:"created_at"`
	ExpiresAt   time.Time `json:"expires_at"`
	Installed   bool      `json:"installed"`
}
