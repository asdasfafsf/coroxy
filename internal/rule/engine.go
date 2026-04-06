package rule

import (
	"net/http"
	"sort"
	"sync"

	"coroxy/internal/adapter"
	"coroxy/internal/intercept"
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
		if intercept.MatchRequest(r.Match, req) {
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

// AddRule inserts a rule in priority order (highest first).
func (e *Engine) AddRule(r *model.Rule) {
	if r == nil {
		return
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	idx := sort.Search(len(e.rules), func(i int) bool {
		return e.rules[i].Priority < r.Priority
	})
	e.rules = append(e.rules, nil)
	copy(e.rules[idx+1:], e.rules[idx:])
	e.rules[idx] = r
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

// ToggleRule enables or disables a rule by ID.
func (e *Engine) ToggleRule(id string) {
	e.mu.Lock()
	defer e.mu.Unlock()

	for _, r := range e.rules {
		if r.ID == id {
			r.Enabled = !r.Enabled
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

