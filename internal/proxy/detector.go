package proxy

import (
	"bytes"

	"coroxy/internal/constant"
)

// DetectProtocol identifies the protocol from the first bytes of a connection.
//
// Detection rules:
//   - TLS: starts with 0x16 0x03 (ContentType=Handshake, Version=TLS 1.x)
//   - HTTP: starts with a known HTTP method (GET, POST, etc.)
//   - SOCKS5: starts with 0x05 (version identifier)
//   - Raw: anything else
func DetectProtocol(peek []byte) constant.Protocol {
	if len(peek) < 2 {
		return constant.ProtocolRaw
	}

	// TLS ClientHello: ContentType 0x16 (Handshake), Version 0x03xx (TLS 1.0-1.3)
	if peek[0] == 0x16 && peek[1] == 0x03 {
		return constant.ProtocolTLS
	}

	// SOCKS5: version byte 0x05
	if peek[0] == 0x05 {
		return constant.ProtocolTCP
	}

	// HTTP: starts with a known method
	for _, method := range [][]byte{
		[]byte("GET "), []byte("POST "), []byte("PUT "), []byte("DELETE "),
		[]byte("HEAD "), []byte("OPTIONS "), []byte("PATCH "),
		[]byte("CONNECT "), []byte("TRACE "),
	} {
		if len(peek) >= len(method) && bytes.Equal(peek[:len(method)], method) {
			return constant.ProtocolHTTP
		}
	}

	return constant.ProtocolRaw
}
