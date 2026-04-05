package app

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"coroxy/internal/adapter"
	"coroxy/internal/model"
	"coroxy/internal/proxy"
	"coroxy/internal/rule"
	"coroxy/internal/session"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is the Wails binding struct that bridges GUI and Core.
type App struct {
	ctx            context.Context
	engine         adapter.ProxyEngine
	store          *session.MemoryStore
	caManager      adapter.CAManager
	ruleEngine     *rule.Engine
	sysProxyActive bool
}

// NewApp creates a new App with its dependencies.
func NewApp(engine adapter.ProxyEngine, store *session.MemoryStore, caManager adapter.CAManager, ruleEngine *rule.Engine) *App {
	return &App{
		engine:     engine,
		store:      store,
		caManager:  caManager,
		ruleEngine: ruleEngine,
	}
}

// SetEngine sets the proxy engine. Used for wiring callbacks during assembly.
func (a *App) SetEngine(engine adapter.ProxyEngine) {
	a.engine = engine
}

// Startup is called when the Wails app starts.
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx

	// Load persisted sessions from disk.
	if err := a.store.Load(); err != nil {
		slog.Error("load sessions", slog.String("error", err.Error()))
	}
}

// Shutdown is called when the Wails app is closing.
func (a *App) Shutdown(_ context.Context) {
	// Disable system proxy if active.
	if a.sysProxyActive {
		if err := proxy.SetSystemProxy(false, ""); err != nil {
			slog.Error("disable system proxy on shutdown", slog.String("error", err.Error()))
		}
	}

	// Persist sessions to disk.
	if err := a.store.Persist(); err != nil {
		slog.Error("persist sessions", slog.String("error", err.Error()))
	}
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

// GetSessionsFiltered returns sessions matching the given filter.
func (a *App) GetSessionsFiltered(filter model.SessionFilter) []*model.Session {
	return a.store.ListWithFilter(filter)
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

// EnableSystemProxy sets the OS system proxy to Coroxy.
func (a *App) EnableSystemProxy() error {
	addr := a.engine.HTTPAddr()
	if err := proxy.SetSystemProxy(true, addr); err != nil {
		return err
	}
	a.sysProxyActive = true
	return nil
}

// DisableSystemProxy turns off the OS system proxy.
func (a *App) DisableSystemProxy() error {
	if err := proxy.SetSystemProxy(false, ""); err != nil {
		return err
	}
	a.sysProxyActive = false
	return nil
}

// IsSystemProxyActive returns whether the system proxy is currently set.
func (a *App) IsSystemProxyActive() bool {
	return a.sysProxyActive
}

// ExportSessionsHAR exports all sessions as HAR to a user-selected file.
func (a *App) ExportSessionsHAR() error {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Export HAR",
		DefaultFilename: "coroxy.har",
		Filters: []runtime.FileFilter{
			{DisplayName: "HAR Files", Pattern: "*.har"},
		},
	})
	if err != nil {
		return err
	}
	if path == "" {
		return nil // user cancelled
	}

	sessions := a.store.List()
	data, err := session.ExportHAR(sessions)
	if err != nil {
		return fmt.Errorf("export HAR: %w", err)
	}
	return os.WriteFile(path, data, 0644)
}

// ExportSessionsJSON exports all sessions as JSON to a user-selected file.
func (a *App) ExportSessionsJSON() error {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Export JSON",
		DefaultFilename: "coroxy-sessions.json",
		Filters: []runtime.FileFilter{
			{DisplayName: "JSON Files", Pattern: "*.json"},
		},
	})
	if err != nil {
		return err
	}
	if path == "" {
		return nil
	}

	sessions := a.store.List()
	data, err := session.ExportJSON(sessions)
	if err != nil {
		return fmt.Errorf("export JSON: %w", err)
	}
	return os.WriteFile(path, data, 0644)
}

// ListRules returns all rules.
func (a *App) ListRules() []*model.Rule {
	return a.ruleEngine.Rules()
}

// AddRule adds a new rule.
func (a *App) AddRule(r *model.Rule) {
	a.ruleEngine.AddRule(r)
}

// RemoveRule removes a rule by ID.
func (a *App) RemoveRule(id string) {
	a.ruleEngine.RemoveRule(id)
}

// ToggleRule enables or disables a rule.
func (a *App) ToggleRule(id string) {
	for _, r := range a.ruleEngine.Rules() {
		if r.ID == id {
			r.Enabled = !r.Enabled
			return
		}
	}
}

// HandleNewSession is called by the proxy when a new session is captured.
func (a *App) HandleNewSession(s *model.Session) {
	a.store.Add(s)

	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "coroxy:session:new", s)
	}
}
