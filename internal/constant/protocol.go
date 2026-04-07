package constant

// Protocol represents the detected network protocol type.
type Protocol string

const (
	// ProtocolUnknown is the zero value for protocol type.
	ProtocolUnknown Protocol = "unknown"
	// ProtocolHTTP represents plain HTTP traffic.
	ProtocolHTTP Protocol = "HTTP"
	// ProtocolTLS represents TLS-encrypted traffic.
	ProtocolTLS Protocol = "TLS"
	// ProtocolTCP represents raw TCP stream traffic.
	ProtocolTCP Protocol = "TCP"
	// ProtocolUDP represents UDP datagram traffic.
	ProtocolUDP Protocol = "UDP"
	// ProtocolRaw represents unrecognized raw bytes.
	ProtocolRaw Protocol = "raw"
)
