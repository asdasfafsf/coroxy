package rule

import (
	"net/http"
	"testing"

	"coroxy/internal/adapter"
	"coroxy/internal/model"
)

func newRule(id, host, path, method string, action model.RuleAction, priority int) *model.Rule {
	return &model.Rule{
		ID:       id,
		Name:     id,
		Enabled:  true,
		Match:    model.MatchCondition{Host: host, Path: path, Method: method},
		Action:   action,
		Priority: priority,
	}
}

func TestMatchExactHost(t *testing.T) {
	e := NewEngine()
	e.AddRule(newRule("r1", "example.com", "", "", model.RuleActionDrop, 1))

	req, _ := http.NewRequest("GET", "http://example.com/test", nil)
	req.Host = "example.com"

	if e.OnRequest(req, nil) != adapter.ActionDrop {
		t.Fatal("expected drop for matching host")
	}
}

func TestMatchWildcardHost(t *testing.T) {
	e := NewEngine()
	e.AddRule(newRule("r1", "*.example.com", "", "", model.RuleActionDrop, 1))

	tests := []struct {
		host    string
		dropped bool
	}{
		{"api.example.com", true},
		{"sub.api.example.com", true}, // *.example.com matches any subdomain depth
		{"example.com", true},         // bare domain matches
		{"other.com", false},
	}

	for _, tt := range tests {
		req, _ := http.NewRequest("GET", "http://"+tt.host, nil)
		req.Host = tt.host

		got := e.OnRequest(req, nil) == adapter.ActionDrop
		if got != tt.dropped {
			t.Errorf("host=%s: dropped=%v, want %v", tt.host, got, tt.dropped)
		}
	}
}

func TestMatchPath(t *testing.T) {
	e := NewEngine()
	e.AddRule(newRule("r1", "", "/api/", "", model.RuleActionDrop, 1))

	tests := []struct {
		path    string
		dropped bool
	}{
		{"/api/users", true},
		{"/api/", true},
		{"/web/page", false},
		{"/", false},
	}

	for _, tt := range tests {
		req, _ := http.NewRequest("GET", "http://example.com"+tt.path, nil)

		got := e.OnRequest(req, nil) == adapter.ActionDrop
		if got != tt.dropped {
			t.Errorf("path=%s: dropped=%v, want %v", tt.path, got, tt.dropped)
		}
	}
}

func TestMatchMethod(t *testing.T) {
	e := NewEngine()
	e.AddRule(newRule("r1", "", "", "POST", model.RuleActionDrop, 1))

	postReq, _ := http.NewRequest("POST", "http://example.com/", nil)
	getReq, _ := http.NewRequest("GET", "http://example.com/", nil)

	if e.OnRequest(postReq, nil) != adapter.ActionDrop {
		t.Fatal("POST should be dropped")
	}
	if e.OnRequest(getReq, nil) != adapter.ActionForward {
		t.Fatal("GET should be forwarded")
	}
}

func TestMatchCombined(t *testing.T) {
	e := NewEngine()
	e.AddRule(newRule("r1", "api.example.com", "/v1/", "POST", model.RuleActionDrop, 1))

	// All conditions match.
	req1, _ := http.NewRequest("POST", "http://api.example.com/v1/data", nil)
	req1.Host = "api.example.com"
	if e.OnRequest(req1, nil) != adapter.ActionDrop {
		t.Fatal("combined match should drop")
	}

	// Host doesn't match.
	req2, _ := http.NewRequest("POST", "http://other.com/v1/data", nil)
	req2.Host = "other.com"
	if e.OnRequest(req2, nil) != adapter.ActionForward {
		t.Fatal("wrong host should forward")
	}
}

func TestDisabledRule(t *testing.T) {
	e := NewEngine()
	r := newRule("r1", "example.com", "", "", model.RuleActionDrop, 1)
	r.Enabled = false
	e.AddRule(r)

	req, _ := http.NewRequest("GET", "http://example.com/", nil)
	req.Host = "example.com"

	if e.OnRequest(req, nil) != adapter.ActionForward {
		t.Fatal("disabled rule should not match")
	}
}

func TestPriorityOrder(t *testing.T) {
	e := NewEngine()
	e.AddRule(newRule("low", "", "", "", model.RuleActionDrop, 1))
	e.AddRule(newRule("high", "", "", "", model.RuleActionDrop, 10))

	rules := e.Rules()
	if rules[0].ID != "high" {
		t.Fatalf("first rule: got %s, want high (priority 10)", rules[0].ID)
	}
}

func TestRemoveRule(t *testing.T) {
	e := NewEngine()
	e.AddRule(newRule("r1", "example.com", "", "", model.RuleActionDrop, 1))
	e.RemoveRule("r1")

	req, _ := http.NewRequest("GET", "http://example.com/", nil)
	req.Host = "example.com"

	if e.OnRequest(req, nil) != adapter.ActionForward {
		t.Fatal("removed rule should not match")
	}
}

func TestNoRules(t *testing.T) {
	e := NewEngine()
	req, _ := http.NewRequest("GET", "http://example.com/", nil)

	if e.OnRequest(req, nil) != adapter.ActionForward {
		t.Fatal("no rules should forward")
	}
}

func TestHostWithPort(t *testing.T) {
	e := NewEngine()
	e.AddRule(newRule("r1", "example.com", "", "", model.RuleActionDrop, 1))

	req, _ := http.NewRequest("GET", "http://example.com:8080/", nil)
	req.Host = "example.com:8080"

	if e.OnRequest(req, nil) != adapter.ActionDrop {
		t.Fatal("host with port should still match")
	}
}
