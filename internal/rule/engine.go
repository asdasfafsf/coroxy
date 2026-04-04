package rule

import (
	"net/http"
	"sort"
	"strings"
	"sync"

	"coroxy/internal/adapter"
	"coroxy/internal/model"
)

// Engine matches HTTP requests against rules and applies actions.
// It implements adapter.Interceptor to plug into the Pipeline.
type Engine struct {
	mu    sync.RWMutex
	rules []*model.Rule
}

// NewEngine creates a new rule matching engine.
func NewEngine() *Engine {
	return &Engine{}
}

// OnRequest checks if any enabled rule matches the request.
// Returns ActionDrop if the first matching rule has drop action.
// Other actions (modify_header, auto_respond, breakpoint) are handled
// by their dedicated interceptors in the pipeline.
func (e *Engine) OnRequest(req *http.Request, _ *model.Session) adapter.Action {
	e.mu.RLock()
	defer e.mu.RUnlock()

	for _, r := range e.rules {
		if !r.Enabled {
			continue
		}
		if matchRequest(r.Match, req) {
			if r.Action == model.RuleActionDrop {
				return adapter.ActionDrop
			}
			// First match wins — other actions are handled by dedicated interceptors.
			return adapter.ActionForward
		}
	}

	return adapter.ActionForward
}

// OnResponse is a no-op for now. Rules are matched on request only.
func (e *Engine) OnResponse(_ *http.Response, _ *model.Session) adapter.Action {
	return adapter.ActionForward
}

// AddRule adds a rule and re-sorts by priority (highest first).
func (e *Engine) AddRule(r *model.Rule) {
	if r == nil {
		return
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	e.rules = append(e.rules, r)
	sort.Slice(e.rules, func(i, j int) bool {
		return e.rules[i].Priority > e.rules[j].Priority
	})
}

// RemoveRule removes a rule by ID.
func (e *Engine) RemoveRule(id string) {
	e.mu.Lock()
	defer e.mu.Unlock()

	for i, r := range e.rules {
		if r.ID == id {
			e.rules = append(e.rules[:i], e.rules[i+1:]...)
			return
		}
	}
}

// Rules returns a copy of all rules.
func (e *Engine) Rules() []*model.Rule {
	e.mu.RLock()
	defer e.mu.RUnlock()

	result := make([]*model.Rule, len(e.rules))
	copy(result, e.rules)
	return result
}

// matchRequest checks if a request matches the given condition.
func matchRequest(cond model.MatchCondition, req *http.Request) bool {
	if cond.Method != "" && !strings.EqualFold(cond.Method, req.Method) {
		return false
	}

	if cond.Host != "" && !matchHost(cond.Host, req.Host) {
		return false
	}

	if cond.Path != "" && !strings.HasPrefix(req.URL.Path, cond.Path) {
		return false
	}

	return true
}

// matchHost matches a hostname against a pattern.
// Supports wildcard prefix: *.example.com matches sub.example.com.
func matchHost(pattern, host string) bool {
	// Remove port from host if present.
	if idx := strings.LastIndex(host, ":"); idx != -1 {
		host = host[:idx]
	}

	if strings.HasPrefix(pattern, "*.") {
		suffix := pattern[1:] // ".example.com"
		return strings.HasSuffix(host, suffix) || host == pattern[2:]
	}

	return strings.EqualFold(pattern, host)
}
