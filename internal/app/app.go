package app

import (
	"context"
	"log/slog"

	"coroxy/internal/adapter"
	"coroxy/internal/intercept"
	"coroxy/internal/proxy"
	"coroxy/internal/rule"
	"coroxy/internal/session"
	"coroxy/internal/throttle"
)

// App is the Wails binding struct that bridges GUI and Core.
type App struct {
	ctx            context.Context
	engine         adapter.ProxyEngine
	store          *session.MemoryStore
	caManager      adapter.CAManager
	ruleEngine     *rule.Engine
	breakpoint     *intercept.Breakpoint
	autoSaver      *session.AutoSaver
	logger         *slog.Logger
	sysProxyActive bool
	throttler      *throttle.Throttler
}

// NewApp creates a new App with its dependencies.
func NewApp(engine adapter.ProxyEngine, store *session.MemoryStore, caManager adapter.CAManager, ruleEngine *rule.Engine, logger *slog.Logger) *App {
	return &App{
		engine:     engine,
		store:      store,
		caManager:  caManager,
		ruleEngine: ruleEngine,
		logger:     logger,
		throttler:  throttle.New(),
	}
}

// SetAutoSaver sets the auto-save handler.
func (a *App) SetAutoSaver(as *session.AutoSaver) {
	a.autoSaver = as
}

// SetBreakpoint sets the breakpoint interceptor for GUI integration.
func (a *App) SetBreakpoint(bp *intercept.Breakpoint) {
	a.breakpoint = bp
}

// SetEngine sets the proxy engine. Used for wiring callbacks during assembly.
func (a *App) SetEngine(engine adapter.ProxyEngine) {
	a.engine = engine
}

// Context returns the Wails context. Used for event emission from outside App.
func (a *App) Context() context.Context {
	return a.ctx
}

// Startup is called when the Wails app starts.
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx

	// Load persisted sessions from disk.
	if err := a.store.Load(); err != nil {
		a.logger.Error("load sessions", slog.String("error", err.Error()))
	}
}

// Shutdown is called when the Wails app is closing.
func (a *App) Shutdown(_ context.Context) {
	// Disable system proxy if active.
	if a.sysProxyActive {
		if err := proxy.SetSystemProxy(false, ""); err != nil {
			a.logger.Error("disable system proxy on shutdown", slog.String("error", err.Error()))
		}
	}

	// Stop auto-saver (flushes remaining data) or persist directly.
	if a.autoSaver != nil {
		if err := a.autoSaver.Stop(); err != nil {
			a.logger.Error("stop autosaver", slog.String("error", err.Error()))
		}
	} else {
		if err := a.store.Persist(); err != nil {
			a.logger.Error("persist sessions", slog.String("error", err.Error()))
		}
	}
}
