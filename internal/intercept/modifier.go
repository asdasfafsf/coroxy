package intercept

import (
	"net/http"
	"strings"

	"coroxy/internal/adapter"
	"coroxy/internal/model"
)

// Modifier applies header modifications from rules to HTTP requests and responses.
// It implements adapter.Interceptor.
type Modifier struct {
	rules func() []*model.Rule
}

// NewModifier creates a Modifier that reads rules from the given provider.
func NewModifier(rules func() []*model.Rule) *Modifier {
	return &Modifier{rules: rules}
}

// OnRequest applies request-targeted header modifications from matching rules.
func (m *Modifier) OnRequest(req *http.Request, _ *model.Session) adapter.Action {
	for _, r := range m.rules() {
		if !r.Enabled || r.Action != model.RuleActionModifyHeader {
			continue
		}
		if !matchRequestForModifier(r.Match, req) {
			continue
		}
		for _, mod := range r.Modifications {
			if mod.Target != "request" {
				continue
			}
			applyHeaderMod(req.Header, mod)
		}
	}
	return adapter.ActionForward
}

// OnResponse applies response-targeted header modifications from matching rules.
func (m *Modifier) OnResponse(resp *http.Response, _ *model.Session) adapter.Action {
	for _, r := range m.rules() {
		if !r.Enabled || r.Action != model.RuleActionModifyHeader {
			continue
		}
		// Response matching uses the request from response.
		if resp.Request != nil && !matchRequestForModifier(r.Match, resp.Request) {
			continue
		}
		for _, mod := range r.Modifications {
			if mod.Target != "response" {
				continue
			}
			applyHeaderMod(resp.Header, mod)
		}
	}
	return adapter.ActionForward
}

// applyHeaderMod applies a single header modification.
// Valid operations: "set", "add", "delete". Unknown operations are ignored.
func applyHeaderMod(h http.Header, mod model.HeaderModification) {
	switch mod.Operation {
	case "set":
		h.Set(mod.Name, mod.Value)
	case "add":
		h.Add(mod.Name, mod.Value)
	case "delete":
		h.Del(mod.Name)
	default:
		// Unknown operation — silently ignored.
		// Rule validation should catch this at creation time.
	}
}

// matchRequestForModifier checks if a request matches the rule condition.
// Duplicated from rule/engine.go to avoid circular dependency.
func matchRequestForModifier(cond model.MatchCondition, req *http.Request) bool {
	if cond.Method != "" && !strings.EqualFold(cond.Method, req.Method) {
		return false
	}
	if cond.Host != "" && !matchHostForModifier(cond.Host, req.Host) {
		return false
	}
	if cond.Path != "" && !strings.HasPrefix(req.URL.Path, cond.Path) {
		return false
	}
	return true
}

// matchHostForModifier matches hostname against pattern (supports *.example.com).
func matchHostForModifier(pattern, host string) bool {
	if idx := strings.LastIndex(host, ":"); idx != -1 {
		host = host[:idx]
	}
	if strings.HasPrefix(pattern, "*.") {
		suffix := pattern[1:]
		return strings.HasSuffix(host, suffix) || host == pattern[2:]
	}
	return strings.EqualFold(pattern, host)
}
