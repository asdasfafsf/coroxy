package proxy

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"sync"

	"coroxy/internal/adapter"
	"coroxy/internal/constant"
	"coroxy/internal/intercept"
	"coroxy/internal/model"
)

// Engine is the core proxy engine that manages listeners and handles traffic.
type Engine struct {
	config    model.ProxyConfig // immutable after construction
	logger    *slog.Logger
	onSession adapter.SessionCallback
	mitm      MITMProvider
	pipeline  *intercept.Pipeline

	mu            sync.Mutex
	state         constant.EngineState
	cancel        context.CancelFunc
	httpServer    *http.Server
	httpAddr      string
	socksListener net.Listener
	socksAddr     string
	wg            sync.WaitGroup
}

// NewEngine creates a new proxy engine with the given configuration.
// If caManager is provided, HTTPS MITM interception is enabled.
func NewEngine(config model.ProxyConfig, logger *slog.Logger, onSession adapter.SessionCallback, mitm MITMProvider, pipeline *intercept.Pipeline) *Engine {
	return &Engine{
		config:    config,
		logger:    logger,
		onSession: onSession,
		mitm:      mitm,
		pipeline:  pipeline,
		state:     constant.EngineStateStopped,
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

	engineCtx, cancel := context.WithCancel(ctx)
	e.cancel = cancel

	httpProxy := NewHTTPProxy(e.logger, e.onSession, e.mitm, e.pipeline)
	listener, err := net.Listen("tcp", e.config.HTTPAddr)
	if err != nil {
		e.state = constant.EngineStateStopped
		e.cancel()
		e.cancel = nil
		return fmt.Errorf("listen on %s: %w", e.config.HTTPAddr, err)
	}

	e.httpServer = &http.Server{
		Handler:  httpProxy,
		BaseContext: func(_ net.Listener) context.Context {
			return engineCtx
		},
		ErrorLog: slog.NewLogLogger(e.logger.Handler(), slog.LevelError),
	}

	server := e.httpServer
	e.wg.Add(1)
	go func() {
		defer e.wg.Done()
		if err := server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
			e.logger.Error("http server error", slog.String("error", err.Error()))
		}
	}()

	// Start SOCKS5 listener.
	socksListener, err := net.Listen("tcp", e.config.SOCKSAddr)
	if err != nil {
		_ = e.httpServer.Close()
		e.state = constant.EngineStateStopped
		e.cancel()
		e.cancel = nil
		return fmt.Errorf("listen socks on %s: %w", e.config.SOCKSAddr, err)
	}
	e.socksListener = socksListener

	socksProxy := NewSOCKS5Proxy(e.logger, e.onSession)
	e.wg.Add(1)
	go func() {
		defer e.wg.Done()
		for {
			conn, err := socksListener.Accept()
			if err != nil {
				return // listener closed
			}
			go func() {
				defer func() {
					if r := recover(); r != nil {
						e.logger.Error("socks5 handler panic", slog.Any("panic", r))
					}
				}()
				socksProxy.HandleConn(conn)
			}()
		}
	}()

	e.httpAddr = listener.Addr().String()
	e.socksAddr = socksListener.Addr().String()

	e.state = constant.EngineStateRunning
	e.logger.Info("proxy engine started",
		slog.String("http_addr", e.httpAddr),
		slog.String("socks_addr", e.socksAddr),
	)

	return nil
}

// Stop gracefully shuts down all listeners.
func (e *Engine) Stop(ctx context.Context) error {
	e.mu.Lock()

	if e.state != constant.EngineStateRunning {
		e.mu.Unlock()
		return fmt.Errorf("stop engine: not running (state: %s)", e.state)
	}

	e.state = constant.EngineStateStopping

	if e.httpServer != nil {
		if err := e.httpServer.Shutdown(ctx); err != nil {
			e.logger.Error("shutdown http server", slog.String("error", err.Error()))
		}
		e.httpServer = nil
	}

	if e.socksListener != nil {
		_ = e.socksListener.Close()
		e.socksListener = nil
	}

	if e.cancel != nil {
		e.cancel()
		e.cancel = nil
	}

	e.mu.Unlock()
	e.wg.Wait()

	e.mu.Lock()
	e.state = constant.EngineStateStopped
	e.mu.Unlock()

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

// HTTPAddr returns the actual HTTP proxy listen address (available after Start).
func (e *Engine) HTTPAddr() string {
	return e.httpAddr
}

// SOCKSAddr returns the actual SOCKS5 proxy listen address (available after Start).
func (e *Engine) SOCKSAddr() string {
	return e.socksAddr
}
