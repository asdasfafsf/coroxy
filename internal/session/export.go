package session

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"coroxy/internal/model"
)

// HAR represents the HTTP Archive format (v1.2).
type HAR struct {
	Log HARLog `json:"log"`
}

// HARLog is the root object of a HAR file.
type HARLog struct {
	Version string     `json:"version"`
	Creator HARCreator `json:"creator"`
	Entries []HAREntry `json:"entries"`
}

// HARCreator identifies the tool that created the HAR.
type HARCreator struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

// HAREntry represents a single HTTP transaction.
type HAREntry struct {
	StartedDateTime string      `json:"startedDateTime"`
	Time            float64     `json:"time"` // milliseconds
	Request         HARRequest  `json:"request"`
	Response        HARResponse `json:"response"`
	Timings         HARTimings  `json:"timings"`
}

// HARTimings represents the timing breakdown per HAR 1.2 spec.
type HARTimings struct {
	DNS      float64 `json:"dns"`
	Connect  float64 `json:"connect"`
	SSL      float64 `json:"ssl"`
	Send     float64 `json:"send"`
	Wait     float64 `json:"wait"`
	Receive  float64 `json:"receive"`
}

// HARRequest represents an HTTP request in HAR format.
type HARRequest struct {
	Method      string          `json:"method"`
	URL         string          `json:"url"`
	HTTPVersion string          `json:"httpVersion"`
	Cookies     []HARCookie     `json:"cookies"`
	Headers     []HARNameValue  `json:"headers"`
	QueryString []HARNameValue  `json:"queryString"`
	PostData    *HARPostData    `json:"postData,omitempty"`
	HeadersSize int             `json:"headersSize"`
	BodySize    int64           `json:"bodySize"`
}

// HARResponse represents an HTTP response in HAR format.
type HARResponse struct {
	Status      int            `json:"status"`
	StatusText  string         `json:"statusText"`
	HTTPVersion string         `json:"httpVersion"`
	Cookies     []HARCookie    `json:"cookies"`
	Headers     []HARNameValue `json:"headers"`
	Content     HARContent     `json:"content"`
	HeadersSize int            `json:"headersSize"`
	BodySize    int64          `json:"bodySize"`
}

// HARContent represents response content in HAR format.
type HARContent struct {
	Size     int64  `json:"size"`
	MimeType string `json:"mimeType"`
	Text     string `json:"text,omitempty"`
}

// HARCookie represents a cookie in HAR format.
type HARCookie struct {
	Name     string `json:"name"`
	Value    string `json:"value"`
	Domain   string `json:"domain,omitempty"`
	Path     string `json:"path,omitempty"`
	Expires  string `json:"expires,omitempty"`
	HTTPOnly bool   `json:"httpOnly,omitempty"`
	Secure   bool   `json:"secure,omitempty"`
	SameSite string `json:"sameSite,omitempty"`
}

// HARPostData represents POST body in HAR format.
type HARPostData struct {
	MimeType string         `json:"mimeType"`
	Text     string         `json:"text"`
	Params   []HARNameValue `json:"params,omitempty"`
}

// HARNameValue represents a name-value pair (header, query param, etc).
type HARNameValue struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// ExportHAR converts sessions to HAR JSON format.
func ExportHAR(sessions []*model.Session) ([]byte, error) {
	har := HAR{
		Log: HARLog{
			Version: "1.2",
			Creator: HARCreator{
				Name:    "Coroxy",
				Version: "0.1.0",
			},
			Entries: make([]HAREntry, 0, len(sessions)),
		},
	}

	for _, s := range sessions {
		if s.Request == nil {
			continue // skip non-HTTP sessions (TCP tunnels, etc.)
		}

		entry := HAREntry{
			StartedDateTime: s.CreatedAt.Format(time.RFC3339Nano),
			Time:            float64(s.Duration.Milliseconds()),
			Request:         convertRequest(s.Request),
			Timings:         convertTimings(s.Timing),
		}

		if s.Response != nil {
			entry.Response = convertResponse(s.Response)
		}

		har.Log.Entries = append(har.Log.Entries, entry)
	}

	data, err := json.MarshalIndent(har, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshal HAR: %w", err)
	}

	return data, nil
}

func convertRequest(msg *model.HTTPMessage) HARRequest {
	httpVersion := msg.HTTPVersion
	if httpVersion == "" {
		httpVersion = "HTTP/1.1"
	}

	req := HARRequest{
		Method:      msg.Method,
		URL:         msg.URL,
		HTTPVersion: httpVersion,
		Cookies:     convertCookies(msg.Cookies),
		Headers:     convertHeaders(msg.Headers),
		QueryString: convertQueryParams(msg.QueryParams),
		HeadersSize: -1,
		BodySize:    msg.BodySize,
	}

	// PostData for request bodies (skip binary).
	if len(msg.Body) > 0 {
		mimeType := msg.ContentType
		if mimeType == "" {
			mimeType = "application/octet-stream"
		}
		req.PostData = &HARPostData{
			MimeType: mimeType,
			Text:     string(msg.Body),
		}
	}

	return req
}

func convertResponse(msg *model.HTTPMessage) HARResponse {
	httpVersion := msg.HTTPVersion
	if httpVersion == "" {
		httpVersion = "HTTP/1.1"
	}

	mimeType := msg.ContentType
	if mimeType == "" {
		mimeType = getContentType(msg)
	}

	resp := HARResponse{
		Status:      msg.StatusCode,
		StatusText:  msg.StatusText,
		HTTPVersion: httpVersion,
		Cookies:     convertCookies(msg.Cookies),
		Headers:     convertHeaders(msg.Headers),
		Content: HARContent{
			Size:     msg.BodySize,
			MimeType: mimeType,
			Text:     textBodyForHAR(msg.Body, mimeType),
		},
		HeadersSize: -1,
		BodySize:    msg.BodySize,
	}
	return resp
}

func convertTimings(t *model.Timing) HARTimings {
	if t == nil {
		return HARTimings{DNS: -1, Connect: -1, SSL: -1, Send: -1, Wait: -1, Receive: -1}
	}
	return HARTimings{
		DNS:     t.DNS,
		Connect: t.Connect,
		SSL:     t.TLS,
		Send:    -1, // not measurable from proxy
		Wait:    t.TTFB,
		Receive: t.Transfer,
	}
}

func convertCookies(cookies []model.HTTPCookie) []HARCookie {
	if len(cookies) == 0 {
		return []HARCookie{}
	}
	result := make([]HARCookie, 0, len(cookies))
	for _, c := range cookies {
		result = append(result, HARCookie{
			Name:     c.Name,
			Value:    c.Value,
			Domain:   c.Domain,
			Path:     c.Path,
			Expires:  c.Expires,
			HTTPOnly: c.HTTPOnly,
			Secure:   c.Secure,
			SameSite: c.SameSite,
		})
	}
	return result
}

func convertQueryParams(params []model.QueryParam) []HARNameValue {
	if len(params) == 0 {
		return []HARNameValue{}
	}
	result := make([]HARNameValue, 0, len(params))
	for _, p := range params {
		result = append(result, HARNameValue{Name: p.Name, Value: p.Value})
	}
	return result
}

func convertHeaders(headers map[string][]string) []HARNameValue {
	if headers == nil || len(headers) == 0 {
		return []HARNameValue{}
	}

	count := 0
	for _, values := range headers {
		count += len(values)
	}

	result := make([]HARNameValue, 0, count)
	for name, values := range headers {
		for _, value := range values {
			result = append(result, HARNameValue{Name: name, Value: value})
		}
	}
	return result
}

// textBodyForHAR returns body as string for text content types, empty for binary.
func textBodyForHAR(body []byte, mimeType string) string {
	if len(body) == 0 {
		return ""
	}
	if isBinaryContentType(mimeType) {
		return ""
	}
	return string(body)
}

// isBinaryContentType returns true for content types that are binary (not text-representable).
func isBinaryContentType(ct string) bool {
	if strings.HasPrefix(ct, "image/") || strings.HasPrefix(ct, "audio/") ||
		strings.HasPrefix(ct, "video/") || strings.HasPrefix(ct, "font/") {
		return true
	}
	if strings.Contains(ct, "octet-stream") || strings.Contains(ct, "protobuf") ||
		strings.Contains(ct, "grpc") || strings.Contains(ct, "wasm") {
		return true
	}
	return false
}

// ExportJSON converts sessions to a JSON array.
func ExportJSON(sessions []*model.Session) ([]byte, error) {
	data, err := json.MarshalIndent(sessions, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshal JSON: %w", err)
	}
	return data, nil
}

func getContentType(msg *model.HTTPMessage) string {
	if msg.Headers == nil {
		return ""
	}
	values, ok := msg.Headers["Content-Type"]
	if !ok || len(values) == 0 {
		return ""
	}
	return values[0]
}
