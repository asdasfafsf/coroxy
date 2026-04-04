package intercept

import (
	"net/http"
	"testing"

	"coroxy/internal/adapter"
	"coroxy/internal/model"
)

func makeModifyRule(host, target, op, name, value string) *model.Rule {
	return &model.Rule{
		ID:      "test",
		Enabled: true,
		Match:   model.MatchCondition{Host: host},
		Action:  model.RuleActionModifyHeader,
		Modifications: []model.HeaderModification{
			{Operation: op, Name: name, Value: value, Target: target},
		},
	}
}

func TestModifierSetRequestHeader(t *testing.T) {
	rules := []*model.Rule{makeModifyRule("example.com", "request", "set", "X-Custom", "injected")}
	m := NewModifier(func() []*model.Rule { return rules })

	req, _ := http.NewRequest("GET", "http://example.com/", nil)
	req.Host = "example.com"

	action := m.OnRequest(req, nil)
	if action != adapter.ActionForward {
		t.Fatalf("action: got %s, want forward", action)
	}
	if got := req.Header.Get("X-Custom"); got != "injected" {
		t.Fatalf("header: got %q, want %q", got, "injected")
	}
}

func TestModifierDeleteRequestHeader(t *testing.T) {
	rules := []*model.Rule{makeModifyRule("example.com", "request", "delete", "Authorization", "")}
	m := NewModifier(func() []*model.Rule { return rules })

	req, _ := http.NewRequest("GET", "http://example.com/", nil)
	req.Host = "example.com"
	req.Header.Set("Authorization", "Bearer secret")

	m.OnRequest(req, nil)
	if got := req.Header.Get("Authorization"); got != "" {
		t.Fatalf("header should be deleted, got %q", got)
	}
}

func TestModifierAddResponseHeader(t *testing.T) {
	rules := []*model.Rule{makeModifyRule("example.com", "response", "add", "X-Proxy", "coroxy")}
	m := NewModifier(func() []*model.Rule { return rules })

	req, _ := http.NewRequest("GET", "http://example.com/", nil)
	req.Host = "example.com"
	resp := &http.Response{Header: http.Header{}, Request: req}

	action := m.OnResponse(resp, nil)
	if action != adapter.ActionForward {
		t.Fatalf("action: got %s, want forward", action)
	}
	if got := resp.Header.Get("X-Proxy"); got != "coroxy" {
		t.Fatalf("header: got %q, want %q", got, "coroxy")
	}
}

func TestModifierNoMatchNoChange(t *testing.T) {
	rules := []*model.Rule{makeModifyRule("other.com", "request", "set", "X-Custom", "injected")}
	m := NewModifier(func() []*model.Rule { return rules })

	req, _ := http.NewRequest("GET", "http://example.com/", nil)
	req.Host = "example.com"

	m.OnRequest(req, nil)
	if got := req.Header.Get("X-Custom"); got != "" {
		t.Fatalf("header should not be set for non-matching host, got %q", got)
	}
}

func TestModifierDisabledRule(t *testing.T) {
	r := makeModifyRule("example.com", "request", "set", "X-Custom", "injected")
	r.Enabled = false
	m := NewModifier(func() []*model.Rule { return []*model.Rule{r} })

	req, _ := http.NewRequest("GET", "http://example.com/", nil)
	req.Host = "example.com"

	m.OnRequest(req, nil)
	if got := req.Header.Get("X-Custom"); got != "" {
		t.Fatalf("disabled rule should not modify, got %q", got)
	}
}
