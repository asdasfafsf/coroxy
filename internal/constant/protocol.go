package constant

// Protocol represents the detected network protocol type.
type Protocol string

const (
	ProtocolUnknown Protocol = "unknown"
	ProtocolHTTP    Protocol = "HTTP"
	ProtocolTLS     Protocol = "TLS"
	ProtocolTCP     Protocol = "TCP"
	ProtocolUDP     Protocol = "UDP"
	ProtocolRaw     Protocol = "raw"
)
