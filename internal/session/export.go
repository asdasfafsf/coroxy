package session

import (
	"encoding/json"
	"fmt"
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
}

// HARRequest represents an HTTP request in HAR format.
type HARRequest struct {
	Method      string          `json:"method"`
	URL         string          `json:"url"`
	HTTPVersion string          `json:"httpVersion"`
	Headers     []HARNameValue  `json:"headers"`
	QueryString []HARNameValue  `json:"queryString"`
	HeadersSize int             `json:"headersSize"`
	BodySize    int64           `json:"bodySize"`
}

// HARResponse represents an HTTP response in HAR format.
type HARResponse struct {
	Status      int            `json:"status"`
	StatusText  string         `json:"statusText"`
	HTTPVersion string         `json:"httpVersion"`
	Headers     []HARNameValue `json:"headers"`
	Content     HARContent     `json:"content"`
	HeadersSize int            `json:"headersSize"`
	BodySize    int64          `json:"bodySize"`
}

// HARContent represents response content in HAR format.
type HARContent struct {
	Size     int64  `json:"size"`
	MimeType string `json:"mimeType"`
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
	req := HARRequest{
		Method:      msg.Method,
		URL:         msg.URL,
		HTTPVersion: "HTTP/1.1",
		Headers:     convertHeaders(msg.Headers),
		HeadersSize: -1,
		BodySize:    0,
	}
	return req
}

func convertResponse(msg *model.HTTPMessage) HARResponse {
	resp := HARResponse{
		Status:      msg.StatusCode,
		StatusText:  msg.StatusText,
		HTTPVersion: "HTTP/1.1",
		Headers:     convertHeaders(msg.Headers),
		Content: HARContent{
			Size:     msg.BodySize,
			MimeType: getContentType(msg),
		},
		HeadersSize: -1,
		BodySize:    msg.BodySize,
	}
	return resp
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
