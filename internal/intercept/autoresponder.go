package intercept

import (
	"bytes"
	"io"
	"net/http"

	"coroxy/internal/adapter"
	"coroxy/internal/model"
)

// AutoResponder intercepts requests matching auto_respond rules
// and returns canned responses without forwarding to the target server.
// It implements adapter.Interceptor.
//
// When a matching auto_respond rule is found, the response is stored
// in the request's context via a response writer, and ActionDrop is returned
// to prevent the proxy from forwarding the request.
type AutoResponder struct {
	rules func() []*model.Rule
}

// NewAutoResponder creates an AutoResponder that reads rules from the given provider.
func NewAutoResponder(rules func() []*model.Rule) *AutoResponder {
	return &AutoResponder{rules: rules}
}

// OnRequest checks if any auto_respond rule matches the request.
// If matched, writes the canned response directly and returns ActionDrop.
func (a *AutoResponder) OnRequest(req *http.Request, _ *model.Session) adapter.Action {
	for _, r := range a.rules() {
		if !r.Enabled || r.Action != model.RuleActionAutoRespond {
			continue
		}
		if r.AutoResponse == nil {
			continue
		}
		if !MatchRequest(r.Match, req) {
			continue
		}

		// Store the auto response in request header for the proxy to pick up.
		// This is a signal — the proxy checks for this header and writes the response.
		req.Header.Set("X-Coroxy-Auto-Response-Rule", r.ID)
		return adapter.ActionDrop
	}

	return adapter.ActionForward
}

// OnResponse is a no-op for auto responder.
func (a *AutoResponder) OnResponse(_ *http.Response, _ *model.Session) adapter.Action {
	return adapter.ActionForward
}

// FindResponse looks up the auto response for a rule ID.
func (a *AutoResponder) FindResponse(ruleID string) *model.AutoResponse {
	for _, r := range a.rules() {
		if r.ID == ruleID && r.AutoResponse != nil {
			return r.AutoResponse
		}
	}
	return nil
}

// BuildHTTPResponse creates an http.Response from an AutoResponse definition.
func BuildHTTPResponse(ar *model.AutoResponse, req *http.Request) *http.Response {
	statusCode := ar.StatusCode
	if statusCode == 0 {
		statusCode = http.StatusOK
	}

	body := ar.Body
	header := http.Header{}

	if ar.ContentType != "" {
		header.Set("Content-Type", ar.ContentType)
	}
	for k, v := range ar.Headers {
		header.Set(k, v)
	}

	return &http.Response{
		StatusCode:    statusCode,
		Status:        http.StatusText(statusCode),
		Proto:         "HTTP/1.1",
		ProtoMajor:    1,
		ProtoMinor:    1,
		Header:        header,
		Body:          io.NopCloser(bytes.NewReader([]byte(body))),
		ContentLength: int64(len(body)),
		Request:       req,
	}
}
