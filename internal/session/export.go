package session

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"

	"coroxy/internal/constant"
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
	DNS     float64 `json:"dns"`
	Connect float64 `json:"connect"`
	SSL     float64 `json:"ssl"`
	Send    float64 `json:"send"`
	Wait    float64 `json:"wait"`
	Receive float64 `json:"receive"`
}

// HARRequest represents an HTTP request in HAR format.
type HARRequest struct {
	Method      string         `json:"method"`
	URL         string         `json:"url"`
	HTTPVersion string         `json:"httpVersion"`
	Cookies     []HARCookie    `json:"cookies"`
	Headers     []HARNameValue `json:"headers"`
	QueryString []HARNameValue `json:"queryString"`
	PostData    *HARPostData   `json:"postData,omitempty"`
	HeadersSize int            `json:"headersSize"`
	BodySize    int64          `json:"bodySize"`
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

	// PostData for request bodies.
	if len(msg.Body) > 0 {
		mimeType := msg.ContentType
		if mimeType == "" {
			mimeType = "application/octet-stream"
		}
		req.PostData = &HARPostData{
			MimeType: mimeType,
			Text:     textBodyForHAR(msg.Body, mimeType),
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
	if len(headers) == 0 {
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

// maxHARFileSize is the maximum size for HAR import (512 MB).
const maxHARFileSize = 512 << 20

// ImportHAR reads a HAR file and returns sessions.
func ImportHAR(path string) ([]*model.Session, error) {
	info, err := os.Stat(path)
	if err != nil {
		return nil, fmt.Errorf("stat HAR file: %w", err)
	}
	if info.Size() > maxHARFileSize {
		return nil, fmt.Errorf("HAR file too large: %d bytes (max %d)", info.Size(), maxHARFileSize)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read HAR file: %w", err)
	}

	var har HAR
	if err := json.Unmarshal(data, &har); err != nil {
		return nil, fmt.Errorf("parse HAR: %w", err)
	}

	sessions := make([]*model.Session, 0, len(har.Log.Entries))
	for _, entry := range har.Log.Entries {
		s := &model.Session{
			ID:       uuid.NewString(),
			Protocol: constant.ProtocolHTTP,
			State:    constant.SessionStateCompleted,
		}

		// Parse timing.
		startTime, errT := time.Parse(time.RFC3339Nano, entry.StartedDateTime)
		if errT == nil {
			s.CreatedAt = startTime
		}
		s.Duration = time.Duration(entry.Time * float64(time.Millisecond))

		// Request.
		s.Request = harRequestToMessage(&entry.Request)

		// Extract target from URL.
		if parsed, errU := url.Parse(entry.Request.URL); errU == nil {
			s.Target.Host = parsed.Hostname()
			if parsed.Scheme == "https" {
				s.Protocol = constant.ProtocolTLS
				s.Target.Port = 443
			} else {
				s.Target.Port = 80
			}
		}

		// Response.
		s.Response = harResponseToMessage(&entry.Response)

		// Timing.
		s.Timing = &model.Timing{
			DNS:      entry.Timings.DNS,
			Connect:  entry.Timings.Connect,
			TLS:      entry.Timings.SSL,
			TTFB:     entry.Timings.Wait,
			Transfer: entry.Timings.Receive,
		}

		sessions = append(sessions, s)
	}

	return sessions, nil
}

func harRequestToMessage(req *HARRequest) *model.HTTPMessage {
	msg := &model.HTTPMessage{
		Method:      req.Method,
		URL:         req.URL,
		HTTPVersion: req.HTTPVersion,
		Headers:     harNameValuesToHeaders(req.Headers),
		BodySize:    req.BodySize,
	}

	if req.PostData != nil {
		msg.Body = []byte(req.PostData.Text)
		msg.BodySize = int64(len(msg.Body))
		msg.ContentType = req.PostData.MimeType
	}

	// Query params.
	for _, nv := range req.QueryString {
		msg.QueryParams = append(msg.QueryParams, model.QueryParam{Name: nv.Name, Value: nv.Value})
	}

	// Cookies.
	for _, c := range req.Cookies {
		msg.Cookies = append(msg.Cookies, model.HTTPCookie{Name: c.Name, Value: c.Value, Domain: c.Domain, Path: c.Path})
	}

	if msg.ContentType == "" && msg.Headers != nil {
		msg.ContentType = msg.Headers.Get("Content-Type")
	}

	return msg
}

func harResponseToMessage(resp *HARResponse) *model.HTTPMessage {
	msg := &model.HTTPMessage{
		StatusCode:  resp.Status,
		StatusText:  resp.StatusText,
		HTTPVersion: resp.HTTPVersion,
		Headers:     harNameValuesToHeaders(resp.Headers),
		BodySize:    resp.Content.Size,
		ContentType: resp.Content.MimeType,
	}

	if resp.Content.Text != "" {
		msg.Body = []byte(resp.Content.Text)
		msg.BodySize = int64(len(msg.Body))
	}

	// Cookies.
	for _, c := range resp.Cookies {
		msg.Cookies = append(msg.Cookies, model.HTTPCookie{
			Name: c.Name, Value: c.Value, Domain: c.Domain, Path: c.Path,
			HTTPOnly: c.HTTPOnly, Secure: c.Secure, SameSite: c.SameSite,
		})
	}

	return msg
}

func harNameValuesToHeaders(nvs []HARNameValue) http.Header {
	if len(nvs) == 0 {
		return http.Header{}
	}
	headers := make(http.Header, len(nvs))
	for _, nv := range nvs {
		headers.Add(nv.Name, nv.Value)
	}
	return headers
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
