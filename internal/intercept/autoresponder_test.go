package intercept

import (
	"io"
	"net/http"
	"testing"

	"coroxy/internal/adapter"
	"coroxy/internal/model"
)

func makeAutoRespondRule(host, path string, statusCode int, body, contentType string) *model.Rule {
	return &model.Rule{
		ID:      "auto1",
		Enabled: true,
		Match:   model.MatchCondition{Host: host, Path: path},
		Action:  model.RuleActionAutoRespond,
		AutoResponse: &model.AutoResponse{
			StatusCode:  statusCode,
			Body:        body,
			ContentType: contentType,
		},
	}
}

func TestAutoResponderMatchReturnsDropAndSignal(t *testing.T) {
	rules := []*model.Rule{makeAutoRespondRule("api.example.com", "/mock", 200, `{"ok":true}`, "application/json")}
	ar := NewAutoResponder(func() []*model.Rule { return rules })

	req, _ := http.NewRequest("GET", "http://api.example.com/mock/data", nil)
	req.Host = "api.example.com"

	action := ar.OnRequest(req, nil)
	if action != adapter.ActionDrop {
		t.Fatalf("action: got %s, want drop", action)
	}

	ruleID := req.Header.Get("X-Coroxy-Auto-Response-Rule")
	if ruleID != "auto1" {
		t.Fatalf("rule ID signal: got %q, want %q", ruleID, "auto1")
	}
}

func TestAutoResponderNoMatchForwards(t *testing.T) {
	rules := []*model.Rule{makeAutoRespondRule("api.example.com", "/mock", 200, "ok", "")}
	ar := NewAutoResponder(func() []*model.Rule { return rules })

	req, _ := http.NewRequest("GET", "http://other.com/real", nil)
	req.Host = "other.com"

	action := ar.OnRequest(req, nil)
	if action != adapter.ActionForward {
		t.Fatalf("action: got %s, want forward", action)
	}
}

func TestAutoResponderDisabledRule(t *testing.T) {
	r := makeAutoRespondRule("api.example.com", "/mock", 200, "ok", "")
	r.Enabled = false
	ar := NewAutoResponder(func() []*model.Rule { return []*model.Rule{r} })

	req, _ := http.NewRequest("GET", "http://api.example.com/mock", nil)
	req.Host = "api.example.com"

	action := ar.OnRequest(req, nil)
	if action != adapter.ActionForward {
		t.Fatal("disabled rule should forward")
	}
}

func TestBuildHTTPResponse(t *testing.T) {
	ar := &model.AutoResponse{
		StatusCode:  201,
		Body:        `{"created":true}`,
		ContentType: "application/json",
		Headers:     map[string]string{"X-Custom": "test"},
	}

	req, _ := http.NewRequest("POST", "http://example.com/api", nil)
	resp := BuildHTTPResponse(ar, req)

	if resp.StatusCode != 201 {
		t.Fatalf("status: got %d, want 201", resp.StatusCode)
	}
	if resp.Header.Get("Content-Type") != "application/json" {
		t.Fatalf("content-type: got %q", resp.Header.Get("Content-Type"))
	}
	if resp.Header.Get("X-Custom") != "test" {
		t.Fatalf("custom header: got %q", resp.Header.Get("X-Custom"))
	}

	body, _ := io.ReadAll(resp.Body)
	if string(body) != `{"created":true}` {
		t.Fatalf("body: got %q", string(body))
	}
}

func TestBuildHTTPResponseDefaultStatus(t *testing.T) {
	ar := &model.AutoResponse{Body: "default"}
	resp := BuildHTTPResponse(ar, nil)

	if resp.StatusCode != 200 {
		t.Fatalf("default status: got %d, want 200", resp.StatusCode)
	}
}

func TestFindResponse(t *testing.T) {
	rules := []*model.Rule{makeAutoRespondRule("x.com", "/", 200, "found", "")}
	ar := NewAutoResponder(func() []*model.Rule { return rules })

	resp := ar.FindResponse("auto1")
	if resp == nil {
		t.Fatal("FindResponse: got nil")
	}
	if resp.Body != "found" {
		t.Fatalf("body: got %q, want %q", resp.Body, "found")
	}

	missing := ar.FindResponse("nonexistent")
	if missing != nil {
		t.Fatal("FindResponse for unknown ID should return nil")
	}
}
