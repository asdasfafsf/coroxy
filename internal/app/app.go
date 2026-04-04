package app

import (
	"context"

	"coroxy/internal/adapter"
	"coroxy/internal/model"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is the Wails binding struct that bridges GUI and Core.
type App struct {
	ctx       context.Context
	engine    adapter.ProxyEngine
	store     adapter.SessionStore
	caManager adapter.CAManager
}

// NewApp creates a new App with its dependencies.
func NewApp(engine adapter.ProxyEngine, store adapter.SessionStore, caManager adapter.CAManager) *App {
	return &App{
		engine:    engine,
		store:     store,
		caManager: caManager,
	}
}

// SetEngine sets the proxy engine. Used for wiring callbacks during assembly.
func (a *App) SetEngine(engine adapter.ProxyEngine) {
	a.engine = engine
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

// InstallCA installs the Root CA into the OS trust store.
func (a *App) InstallCA() error {
	return a.caManager.InstallCA()
}

// UninstallCA removes the Root CA from the OS trust store.
func (a *App) UninstallCA() error {
	return a.caManager.UninstallCA()
}

// GetCAInfo returns metadata about the Root CA.
func (a *App) GetCAInfo() model.CAInfo {
	return a.caManager.CAInfo()
}

// ExportCA exports the Root CA certificate to the given path.
func (a *App) ExportCA(path string) error {
	return a.caManager.ExportCA(path)
}

// HandleNewSession is called by the proxy when a new session is captured.
func (a *App) HandleNewSession(s *model.Session) {
	a.store.Add(s)

	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "coroxy:session:new", s)
	}
}
