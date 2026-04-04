package intercept

import (
	"net/http"
	"strings"
	"sync"

	"coroxy/internal/adapter"
	"coroxy/internal/model"

	"github.com/google/uuid"
)

// PendingRequest represents a request paused at a breakpoint.
type PendingRequest struct {
	ID      string
	Request *http.Request
	RuleID  string
	resume  chan struct{}
}

// Breakpoint intercepts requests matching breakpoint rules and pauses them
// until Resume is called. Implements adapter.Interceptor.
type Breakpoint struct {
	rules   func() []*model.Rule
	onPause func(pending *PendingRequest) // callback when request is paused

	mu      sync.Mutex
	pending map[string]*PendingRequest
}

// NewBreakpoint creates a Breakpoint interceptor.
// onPause is called when a request hits a breakpoint (for GUI notification).
// onPause must not be nil — if no callback is provided, matched requests
// will block forever since there is no way to call Resume.
func NewBreakpoint(rules func() []*model.Rule, onPause func(*PendingRequest)) *Breakpoint {
	if onPause == nil {
		panic("breakpoint: onPause callback must not be nil")
	}
	return &Breakpoint{
		rules:   rules,
		onPause: onPause,
		pending: make(map[string]*PendingRequest),
	}
}

// OnRequest checks if any breakpoint rule matches and pauses the request.
func (b *Breakpoint) OnRequest(req *http.Request, _ *model.Session) adapter.Action {
	for _, r := range b.rules() {
		if !r.Enabled || r.Action != model.RuleActionBreakpoint {
			continue
		}
		if !matchRequestForBreakpoint(r.Match, req) {
			continue
		}

		pending := &PendingRequest{
			ID:      uuid.NewString(),
			Request: req,
			RuleID:  r.ID,
			resume:  make(chan struct{}),
		}

		b.mu.Lock()
		b.pending[pending.ID] = pending
		b.mu.Unlock()

		b.onPause(pending)

		// Block until Resume is called.
		<-pending.resume

		b.mu.Lock()
		delete(b.pending, pending.ID)
		b.mu.Unlock()

		return adapter.ActionForward
	}

	return adapter.ActionForward
}

// OnResponse is a no-op for breakpoints (request-only).
func (b *Breakpoint) OnResponse(_ *http.Response, _ *model.Session) adapter.Action {
	return adapter.ActionForward
}

// Resume unblocks a paused request by its pending ID.
func (b *Breakpoint) Resume(pendingID string) {
	b.mu.Lock()
	pending, ok := b.pending[pendingID]
	b.mu.Unlock()

	if ok {
		close(pending.resume)
	}
}

// Drop cancels a paused request (returns drop action).
func (b *Breakpoint) Drop(pendingID string) {
	b.mu.Lock()
	pending, ok := b.pending[pendingID]
	b.mu.Unlock()

	if ok {
		// Signal resume but mark request as dropped via header.
		pending.Request.Header.Set("X-Coroxy-Breakpoint-Dropped", "true")
		close(pending.resume)
	}
}

// PendingRequests returns all currently paused requests.
func (b *Breakpoint) PendingRequests() []*PendingRequest {
	b.mu.Lock()
	defer b.mu.Unlock()

	result := make([]*PendingRequest, 0, len(b.pending))
	for _, p := range b.pending {
		result = append(result, p)
	}
	return result
}

func matchRequestForBreakpoint(cond model.MatchCondition, req *http.Request) bool {
	if cond.Method != "" && !strings.EqualFold(cond.Method, req.Method) {
		return false
	}
	if cond.Host != "" && !matchHostForBreakpoint(cond.Host, req.Host) {
		return false
	}
	if cond.Path != "" && !strings.HasPrefix(req.URL.Path, cond.Path) {
		return false
	}
	return true
}

func matchHostForBreakpoint(pattern, host string) bool {
	if idx := strings.LastIndex(host, ":"); idx != -1 {
		host = host[:idx]
	}
	if strings.HasPrefix(pattern, "*.") {
		suffix := pattern[1:]
		return strings.HasSuffix(host, suffix) || host == pattern[2:]
	}
	return strings.EqualFold(pattern, host)
}
