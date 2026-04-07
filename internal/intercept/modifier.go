package intercept

import (
	"bytes"
	"io"
	"net/http"
	"regexp"
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

// OnRequest applies request-targeted header and body modifications from matching rules.
func (m *Modifier) OnRequest(req *http.Request, _ *model.Session) adapter.Action {
	for _, r := range m.rules() {
		if !r.Enabled {
			continue
		}
		if !MatchRequest(r.Match, req) {
			continue
		}

		if r.Action == model.RuleActionModifyHeader {
			for _, mod := range r.Modifications {
				if mod.Target != "request" {
					continue
				}
				applyHeaderMod(req.Header, mod)
			}
		}

		if r.Action == model.RuleActionModifyBody && req.Body != nil {
			for _, mod := range r.BodyModifications {
				if mod.Target != "request" {
					continue
				}
				req.Body = applyBodyMod(req.Body, mod)
			}
		}
	}
	return adapter.ActionForward
}

// OnResponse applies response-targeted header and body modifications from matching rules.
func (m *Modifier) OnResponse(resp *http.Response, _ *model.Session) adapter.Action {
	for _, r := range m.rules() {
		if !r.Enabled {
			continue
		}
		if resp.Request != nil && !MatchRequest(r.Match, resp.Request) {
			continue
		}

		if r.Action == model.RuleActionModifyHeader {
			for _, mod := range r.Modifications {
				if mod.Target != "response" {
					continue
				}
				applyHeaderMod(resp.Header, mod)
			}
		}

		if r.Action == model.RuleActionModifyBody && resp.Body != nil {
			for _, mod := range r.BodyModifications {
				if mod.Target != "response" {
					continue
				}
				resp.Body = applyBodyMod(resp.Body, mod)
			}
		}
	}
	return adapter.ActionForward
}

// applyBodyMod reads the body, applies find/replace, and returns a new ReadCloser.
func applyBodyMod(body io.ReadCloser, mod model.BodyModification) io.ReadCloser {
	data, err := io.ReadAll(io.LimitReader(body, 32<<20))
	_ = body.Close()
	if err != nil || len(data) == 0 {
		return io.NopCloser(bytes.NewReader(data))
	}

	var result string
	if mod.IsRegex {
		re, err := regexp.Compile(mod.Find)
		if err != nil {
			return io.NopCloser(bytes.NewReader(data))
		}
		result = re.ReplaceAllString(string(data), mod.Replace)
	} else {
		result = strings.ReplaceAll(string(data), mod.Find, mod.Replace)
	}

	return io.NopCloser(strings.NewReader(result))
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
