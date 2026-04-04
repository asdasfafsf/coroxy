package app

import (
	"context"
	"log/slog"

	"coroxy/internal/adapter"
	"coroxy/internal/model"
	"coroxy/internal/proxy"
	"coroxy/internal/session"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is the Wails binding struct that bridges GUI and Core.
type App struct {
	ctx    context.Context
	logger *slog.Logger
	engine *proxy.Engine
	store  adapter.SessionStore
}

// NewApp creates a new App with its dependencies.
func NewApp(logger *slog.Logger) *App {
	store := session.NewMemoryStore()

	a := &App{
		logger: logger,
		store:  store,
	}

	engine := proxy.NewEngine(
		model.DefaultProxyConfig(),
		logger,
		a.handleNewSession,
	)
	a.engine = engine

	return a
}

// Startup is called when the Wails app starts.
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
}

// StartProxy starts the proxy engine.
func (a *App) StartProxy() error {
	return a.engine.Start(a.ctx)
}

// StopProxy stops the proxy engine.
func (a *App) StopProxy() error {
	return a.engine.Stop(a.ctx)
}

// GetProxyState returns the current proxy engine state.
func (a *App) GetProxyState() string {
	return string(a.engine.State())
}

// GetSessions returns all captured sessions.
func (a *App) GetSessions() []*model.Session {
	return a.store.List()
}

// ClearSessions removes all captured sessions.
func (a *App) ClearSessions() {
	a.store.Clear()
}

// handleNewSession is called by the proxy when a new session is captured.
func (a *App) handleNewSession(s *model.Session) {
	a.store.Add(s)

	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "coroxy:session:new", s)
	}
}
