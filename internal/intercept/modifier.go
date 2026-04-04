package intercept

import (
	"net/http"

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
		if !MatchRequest(r.Match, req) {
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
		if resp.Request != nil && !MatchRequest(r.Match, resp.Request) {
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
func applyHeaderMod(h http.Header, mod model.HeaderModification) {
	switch mod.Operation {
	case "set":
		h.Set(mod.Name, mod.Value)
	case "add":
		h.Add(mod.Name, mod.Value)
	case "delete":
		h.Del(mod.Name)
	}
}
