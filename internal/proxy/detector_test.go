package proxy

import (
	"testing"

	"coroxy/internal/constant"
)

func TestDetectProtocol(t *testing.T) {
	tests := []struct {
		name     string
		input    []byte
		expected constant.Protocol
	}{
		{"TLS ClientHello", []byte{0x16, 0x03, 0x01, 0x00}, constant.ProtocolTLS},
		{"TLS 1.2", []byte{0x16, 0x03, 0x03, 0x00, 0x05}, constant.ProtocolTLS},
		{"TLS 1.3", []byte{0x16, 0x03, 0x03, 0x01, 0x00}, constant.ProtocolTLS},
		{"HTTP GET", []byte("GET / HTTP/1.1\r\n"), constant.ProtocolHTTP},
		{"HTTP POST", []byte("POST /api HTTP/1.1\r\n"), constant.ProtocolHTTP},
		{"HTTP PUT", []byte("PUT /resource HTTP/1.1\r\n"), constant.ProtocolHTTP},
		{"HTTP DELETE", []byte("DELETE /item HTTP/1.1\r\n"), constant.ProtocolHTTP},
		{"HTTP HEAD", []byte("HEAD / HTTP/1.1\r\n"), constant.ProtocolHTTP},
		{"HTTP OPTIONS", []byte("OPTIONS * HTTP/1.1\r\n"), constant.ProtocolHTTP},
		{"HTTP PATCH", []byte("PATCH /update HTTP/1.1\r\n"), constant.ProtocolHTTP},
		{"HTTP CONNECT", []byte("CONNECT example.com:443 HTTP/1.1\r\n"), constant.ProtocolHTTP},
		{"HTTP TRACE", []byte("TRACE / HTTP/1.1\r\n"), constant.ProtocolHTTP},
		{"Raw binary", []byte{0x00, 0x01, 0x02, 0x03}, constant.ProtocolRaw},
		{"Random text", []byte("hello world"), constant.ProtocolRaw},
		{"SOCKS5", []byte{0x05, 0x01, 0x00}, constant.ProtocolTCP},
		{"Empty", []byte{}, constant.ProtocolRaw},
		{"Single byte", []byte{0x16}, constant.ProtocolRaw},
		{"Almost TLS", []byte{0x16, 0x04}, constant.ProtocolRaw},
		{"GET without space", []byte("GETX"), constant.ProtocolRaw},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := DetectProtocol(tt.input)
			if got != tt.expected {
				t.Fatalf("got %s, want %s", got, tt.expected)
			}
		})
	}
}
