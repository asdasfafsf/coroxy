package proxy

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"coroxy/internal/constant"
	"coroxy/internal/model"
)

// Engine is the core proxy engine that manages listeners and handles traffic.
type Engine struct {
	config model.ProxyConfig // immutable after construction
	logger *slog.Logger

	mu     sync.Mutex
	state  constant.EngineState
	ctx    context.Context
	cancel context.CancelFunc
}

// NewEngine creates a new proxy engine with the given configuration.
func NewEngine(config model.ProxyConfig, logger *slog.Logger) *Engine {
	return &Engine{
		config: config,
		logger: logger,
		state:  constant.EngineStateStopped,
	}
}

// Start begins listening on configured addresses.
func (e *Engine) Start(ctx context.Context) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.state != constant.EngineStateStopped {
		return fmt.Errorf("start engine: already %s", e.state)
	}

	e.state = constant.EngineStateStarting

	ctx, cancel := context.WithCancel(ctx)
	e.ctx = ctx
	e.cancel = cancel

	e.state = constant.EngineStateRunning
	e.logger.Info("proxy engine started",
		slog.String("http_addr", e.config.HTTPAddr),
		slog.String("socks_addr", e.config.SOCKSAddr),
	)

	return nil
}

// Stop gracefully shuts down all listeners.
func (e *Engine) Stop(_ context.Context) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.state != constant.EngineStateRunning {
		return fmt.Errorf("stop engine: not running (state: %s)", e.state)
	}

	e.state = constant.EngineStateStopping

	if e.cancel != nil {
		e.cancel()
		e.cancel = nil
		e.ctx = nil
	}

	e.state = constant.EngineStateStopped
	e.logger.Info("proxy engine stopped")

	return nil
}

// State returns the current engine state.
func (e *Engine) State() constant.EngineState {
	e.mu.Lock()
	defer e.mu.Unlock()

	return e.state
}

// Config returns the current proxy configuration.
func (e *Engine) Config() model.ProxyConfig {
	return e.config
}
