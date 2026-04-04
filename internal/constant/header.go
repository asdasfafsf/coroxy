package constant

// Internal headers used for cross-component signaling.
const (
	// HeaderAutoResponseRule is set by AutoResponder on a matching request.
	// The proxy checks this header to serve a canned response instead of forwarding.
	HeaderAutoResponseRule = "X-Coroxy-Auto-Response-Rule"

	// HeaderBreakpointDropped is set by Breakpoint.Drop to signal the proxy
	// that the request was dropped at a breakpoint.
	HeaderBreakpointDropped = "X-Coroxy-Breakpoint-Dropped"
)
