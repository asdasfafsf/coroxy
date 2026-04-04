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

// HTTPCookie represents a parsed cookie.
type HTTPCookie struct {
	Name     string `json:"name"`
	Value    string `json:"value"`
	Domain   string `json:"domain,omitempty"`
	Path     string `json:"path,omitempty"`
	Expires  string `json:"expires,omitempty"`
	MaxAge   int    `json:"max_age,omitempty"`
	Secure   bool   `json:"secure,omitempty"`
	HTTPOnly bool   `json:"http_only,omitempty"`
	SameSite string `json:"same_site,omitempty"`
}

// QueryParam represents a parsed query parameter.
type QueryParam struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// HTTPMessage represents an HTTP request or response.
type HTTPMessage struct {
	Method          string       `json:"method,omitempty"`
	URL             string       `json:"url,omitempty"`
	StatusCode      int          `json:"status_code,omitempty"`
	StatusText      string       `json:"status_text,omitempty"`
	HTTPVersion     string       `json:"http_version,omitempty"`
	Headers         http.Header  `json:"headers,omitempty"`
	Cookies         []HTTPCookie `json:"cookies,omitempty"`
	QueryParams     []QueryParam `json:"query_params,omitempty"`
	ContentType     string       `json:"content_type,omitempty"`
	ContentEncoding string       `json:"content_encoding,omitempty"`
	Body            []byte       `json:"body,omitempty"`
	BodySize        int64        `json:"body_size"`
}
