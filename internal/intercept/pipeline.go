package intercept

import (
	"net/http"
	"sync"

	"coroxy/internal/adapter"
	"coroxy/internal/model"
)

// Pipeline chains multiple interceptors and executes them in order.
type Pipeline struct {
	mu           sync.RWMutex
	interceptors []adapter.Interceptor
}

// NewPipeline creates an empty interceptor pipeline.
func NewPipeline() *Pipeline {
	return &Pipeline{}
}

// Add appends an interceptor to the pipeline.
func (p *Pipeline) Add(i adapter.Interceptor) {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.interceptors = append(p.interceptors, i)
}

// Remove removes an interceptor from the pipeline by reference.
func (p *Pipeline) Remove(target adapter.Interceptor) {
	p.mu.Lock()
	defer p.mu.Unlock()

	for i, interceptor := range p.interceptors {
		if interceptor == target {
			p.interceptors = append(p.interceptors[:i], p.interceptors[i+1:]...)
			return
		}
	}
}

// ProcessRequest runs all interceptors on the request in order.
// Returns ActionDrop if any interceptor drops the request.
func (p *Pipeline) ProcessRequest(req *http.Request, session *model.Session) adapter.Action {
	p.mu.RLock()
	interceptors := make([]adapter.Interceptor, len(p.interceptors))
	copy(interceptors, p.interceptors)
	p.mu.RUnlock()

	for _, i := range interceptors {
		action := i.OnRequest(req, session)
		if action == adapter.ActionDrop {
			return adapter.ActionDrop
		}
	}

	return adapter.ActionForward
}

// ProcessResponse runs all interceptors on the response in order.
// Returns ActionDrop if any interceptor drops the response.
func (p *Pipeline) ProcessResponse(resp *http.Response, session *model.Session) adapter.Action {
	p.mu.RLock()
	interceptors := make([]adapter.Interceptor, len(p.interceptors))
	copy(interceptors, p.interceptors)
	p.mu.RUnlock()

	for _, i := range interceptors {
		action := i.OnResponse(resp, session)
		if action == adapter.ActionDrop {
			return adapter.ActionDrop
		}
	}

	return adapter.ActionForward
}

// Count returns the number of interceptors in the pipeline.
func (p *Pipeline) Count() int {
	p.mu.RLock()
	defer p.mu.RUnlock()

	return len(p.interceptors)
}
