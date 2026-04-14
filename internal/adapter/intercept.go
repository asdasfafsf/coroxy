package adapter

import (
	"net/http"

	"coroxy/internal/model"
)

// Action represents the result of an interceptor processing a request or response.
type Action string

const (
	// ActionUnknown is the zero value for interceptor action.
	ActionUnknown Action = "unknown"

	// ActionForward passes the request/response through unchanged.
	ActionForward Action = "forward"

	// ActionDrop silently drops the request/response.
	ActionDrop Action = "drop"
)

// Interceptor processes HTTP requests and responses in the proxy pipeline.
// Multiple interceptors are chained in order. Each can inspect, modify, or drop traffic.
type Interceptor interface {
	// OnRequest is called before the request is sent to the target server.
	// The interceptor may modify the request in place.
	OnRequest(req *http.Request, session *model.Session) Action

	// OnResponse is called before the response is sent back to the client.
	// The interceptor may modify the response in place.
	OnResponse(resp *http.Response, session *model.Session) Action
}
