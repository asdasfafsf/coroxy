package intercept

import (
	"net/http"
	"sync"
	"testing"
	"time"

	"coroxy/internal/adapter"
	"coroxy/internal/constant"
	"coroxy/internal/model"
)

func makeBreakpointRule(host string) *model.Rule {
	return &model.Rule{
		ID:      "bp1",
		Enabled: true,
		Match:   model.MatchCondition{Host: host},
		Action:  model.RuleActionBreakpoint,
	}
}

func TestBreakpointPausesAndResumes(t *testing.T) {
	rules := []*model.Rule{makeBreakpointRule("example.com")}

	var paused *PendingRequest
	var pauseWg sync.WaitGroup
	pauseWg.Add(1)

	bp := NewBreakpoint(
		func() []*model.Rule { return rules },
		func(p *PendingRequest) {
			paused = p
			pauseWg.Done()
		},
	)

	req, _ := http.NewRequest("GET", "http://example.com/test", nil)
	req.Host = "example.com"

	var action adapter.Action
	var actionWg sync.WaitGroup
	actionWg.Add(1)

	go func() {
		action = bp.OnRequest(req, nil)
		actionWg.Done()
	}()

	// Wait for pause callback.
	pauseWg.Wait()

	if paused == nil {
		t.Fatal("paused: got nil")
	}
	if len(bp.PendingRequests()) != 1 {
		t.Fatalf("pending: got %d, want 1", len(bp.PendingRequests()))
	}

	// Resume.
	bp.Resume(paused.ID)
	actionWg.Wait()

	if action != adapter.ActionForward {
		t.Fatalf("action after resume: got %s, want forward", action)
	}
	if len(bp.PendingRequests()) != 0 {
		t.Fatalf("pending after resume: got %d, want 0", len(bp.PendingRequests()))
	}
}

func TestBreakpointDrop(t *testing.T) {
	rules := []*model.Rule{makeBreakpointRule("example.com")}

	var paused *PendingRequest
	var pauseWg sync.WaitGroup
	pauseWg.Add(1)

	bp := NewBreakpoint(
		func() []*model.Rule { return rules },
		func(p *PendingRequest) {
			paused = p
			pauseWg.Done()
		},
	)

	req, _ := http.NewRequest("GET", "http://example.com/test", nil)
	req.Host = "example.com"

	var actionWg sync.WaitGroup
	actionWg.Add(1)

	go func() {
		bp.OnRequest(req, nil)
		actionWg.Done()
	}()

	pauseWg.Wait()
	bp.Drop(paused.ID)
	actionWg.Wait()

	if req.Header.Get(constant.HeaderBreakpointDropped) != "true" {
		t.Fatal("drop signal not set")
	}
}

func TestBreakpointNoMatchForwards(t *testing.T) {
	rules := []*model.Rule{makeBreakpointRule("other.com")}
	bp := NewBreakpoint(func() []*model.Rule { return rules }, nil)

	req, _ := http.NewRequest("GET", "http://example.com/test", nil)
	req.Host = "example.com"

	done := make(chan adapter.Action, 1)
	go func() {
		done <- bp.OnRequest(req, nil)
	}()

	select {
	case action := <-done:
		if action != adapter.ActionForward {
			t.Fatalf("action: got %s, want forward", action)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("timeout: request should not block when no match")
	}
}

func TestBreakpointDisabledRule(t *testing.T) {
	r := makeBreakpointRule("example.com")
	r.Enabled = false
	bp := NewBreakpoint(func() []*model.Rule { return []*model.Rule{r} }, nil)

	req, _ := http.NewRequest("GET", "http://example.com/test", nil)
	req.Host = "example.com"

	done := make(chan adapter.Action, 1)
	go func() {
		done <- bp.OnRequest(req, nil)
	}()

	select {
	case action := <-done:
		if action != adapter.ActionForward {
			t.Fatalf("action: got %s, want forward", action)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("timeout: disabled rule should not block")
	}
}
