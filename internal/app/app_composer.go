package app

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// ComposerRequest is the input for sending a custom HTTP request.
type ComposerRequest struct {
	Method  string            `json:"method"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
}

// ComposerResponse is the result of a custom HTTP request.
type ComposerResponse struct {
	StatusCode int               `json:"status_code"`
	StatusText string            `json:"status_text"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
	BodySize   int64             `json:"body_size"`
	DurationMs int64             `json:"duration_ms"`
}

// SendRequest sends a custom HTTP request and returns the response.
func (a *App) SendRequest(req ComposerRequest) (*ComposerResponse, error) {
	var bodyReader io.Reader
	if req.Body != "" {
		bodyReader = strings.NewReader(req.Body)
	}

	httpReq, err := http.NewRequestWithContext(a.ctx, req.Method, req.URL, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	for k, v := range req.Headers {
		httpReq.Header.Set(k, v)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	start := time.Now()

	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 32<<20))
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	headers := make(map[string]string)
	for k, v := range resp.Header {
		headers[k] = strings.Join(v, ", ")
	}

	return &ComposerResponse{
		StatusCode: resp.StatusCode,
		StatusText: http.StatusText(resp.StatusCode),
		Headers:    headers,
		Body:       string(body),
		BodySize:   int64(len(body)),
		DurationMs: time.Since(start).Milliseconds(),
	}, nil
}

// ReplaySession re-sends the request from an existing session and returns the response.
func (a *App) ReplaySession(sessionID string) (*ComposerResponse, error) {
	s := a.store.Get(sessionID)
	if s == nil {
		return nil, fmt.Errorf("session not found: %s", sessionID)
	}
	if s.Request == nil {
		return nil, fmt.Errorf("session has no request: %s", sessionID)
	}

	headers := make(map[string]string)
	for k, vs := range s.Request.Headers {
		if len(vs) > 0 {
			headers[k] = vs[0]
		}
	}

	req := ComposerRequest{
		Method:  s.Request.Method,
		URL:     s.Request.URL,
		Headers: headers,
		Body:    string(s.Request.Body),
	}

	return a.SendRequest(req)
}
