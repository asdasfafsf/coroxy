package intercept

import (
	"net/http"
	"testing"

	"coroxy/internal/adapter"
	"coroxy/internal/model"
)

// testInterceptor records calls and returns a configurable action.
type testInterceptor struct {
	reqAction  adapter.Action
	respAction adapter.Action
	reqCalls   int
	respCalls  int
}

func (t *testInterceptor) OnRequest(_ *http.Request, _ *model.Session) adapter.Action {
	t.reqCalls++
	return t.reqAction
}

func (t *testInterceptor) OnResponse(_ *http.Response, _ *model.Session) adapter.Action {
	t.respCalls++
	return t.respAction
}

func TestPipelineEmpty(t *testing.T) {
	p := NewPipeline()

	req, _ := http.NewRequest("GET", "http://example.com", nil)
	action := p.ProcessRequest(req, nil)

	if action != adapter.ActionForward {
		t.Fatalf("empty pipeline: got %s, want forward", action)
	}
}

func TestPipelineForwardChain(t *testing.T) {
	p := NewPipeline()
	i1 := &testInterceptor{reqAction: adapter.ActionForward, respAction: adapter.ActionForward}
	i2 := &testInterceptor{reqAction: adapter.ActionForward, respAction: adapter.ActionForward}
	p.Add(i1)
	p.Add(i2)

	req, _ := http.NewRequest("GET", "http://example.com", nil)
	action := p.ProcessRequest(req, nil)

	if action != adapter.ActionForward {
		t.Fatalf("action: got %s, want forward", action)
	}
	if i1.reqCalls != 1 || i2.reqCalls != 1 {
		t.Fatalf("calls: i1=%d, i2=%d, want 1,1", i1.reqCalls, i2.reqCalls)
	}
}

func TestPipelineDropStopsChain(t *testing.T) {
	p := NewPipeline()
	i1 := &testInterceptor{reqAction: adapter.ActionDrop}
	i2 := &testInterceptor{reqAction: adapter.ActionForward}
	p.Add(i1)
	p.Add(i2)

	req, _ := http.NewRequest("GET", "http://example.com", nil)
	action := p.ProcessRequest(req, nil)

	if action != adapter.ActionDrop {
		t.Fatalf("action: got %s, want drop", action)
	}
	// i2 should NOT be called because i1 dropped.
	if i2.reqCalls != 0 {
		t.Fatalf("i2 calls: got %d, want 0 (chain should stop on drop)", i2.reqCalls)
	}
}

func TestPipelineResponse(t *testing.T) {
	p := NewPipeline()
	i := &testInterceptor{reqAction: adapter.ActionForward, respAction: adapter.ActionDrop}
	p.Add(i)

	resp := &http.Response{StatusCode: 200}
	action := p.ProcessResponse(resp, nil)

	if action != adapter.ActionDrop {
		t.Fatalf("action: got %s, want drop", action)
	}
	if i.respCalls != 1 {
		t.Fatalf("resp calls: got %d, want 1", i.respCalls)
	}
}

func TestPipelineRemove(t *testing.T) {
	p := NewPipeline()
	i1 := &testInterceptor{reqAction: adapter.ActionForward}
	i2 := &testInterceptor{reqAction: adapter.ActionForward}
	p.Add(i1)
	p.Add(i2)

	if p.Count() != 2 {
		t.Fatalf("count: got %d, want 2", p.Count())
	}

	p.Remove(i1)

	if p.Count() != 1 {
		t.Fatalf("count after remove: got %d, want 1", p.Count())
	}

	req, _ := http.NewRequest("GET", "http://example.com", nil)
	p.ProcessRequest(req, nil)

	if i1.reqCalls != 0 {
		t.Fatal("removed interceptor should not be called")
	}
	if i2.reqCalls != 1 {
		t.Fatal("remaining interceptor should be called")
	}
}

func TestPipelineCount(t *testing.T) {
	p := NewPipeline()

	if p.Count() != 0 {
		t.Fatalf("initial count: got %d, want 0", p.Count())
	}

	p.Add(&testInterceptor{})
	p.Add(&testInterceptor{})

	if p.Count() != 2 {
		t.Fatalf("count: got %d, want 2", p.Count())
	}
}
