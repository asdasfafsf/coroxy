package model

import (
	"net/http"
	"time"

	"coroxy/internal/constant"
)

// Session represents a captured network session.
type Session struct {
	ID        string                `json:"id"`
	Protocol  constant.Protocol    `json:"protocol"`
	Source    Endpoint              `json:"source"`
	Target    Endpoint              `json:"target"`
	Request   *HTTPMessage          `json:"request,omitempty"`
	Response  *HTTPMessage          `json:"response,omitempty"`
	State     constant.SessionState `json:"state"`
	CreatedAt time.Time             `json:"created_at"`
	Duration  time.Duration         `json:"duration"`
}

// Endpoint represents a network endpoint.
type Endpoint struct {
	Host string `json:"host"`
	Port int    `json:"port"`
}

// HTTPMessage represents an HTTP request or response.
type HTTPMessage struct {
	Method     string      `json:"method,omitempty"`
	URL        string      `json:"url,omitempty"`
	StatusCode int         `json:"status_code,omitempty"`
	StatusText string      `json:"status_text,omitempty"`
	Headers    http.Header `json:"headers,omitempty"`
	BodySize   int64       `json:"body_size"`
}
