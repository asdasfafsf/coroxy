package app

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"coroxy/internal/adapter"
	"coroxy/internal/intercept"
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
	breakpoint     *intercept.Breakpoint
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

// SetBreakpoint sets the breakpoint interceptor for GUI integration.
func (a *App) SetBreakpoint(bp *intercept.Breakpoint) {
	a.breakpoint = bp
}

// SetEngine sets the proxy engine. Used for wiring callbacks during assembly.
func (a *App) SetEngine(engine adapter.ProxyEngine) {
	a.engine = engine
}

// GetContext returns the Wails context. Used for event emission from outside App.
func (a *App) GetContext() context.Context {
	return a.ctx
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
	a.ruleEngine.ToggleRule(id)
}

// BreakpointResume resumes a paused request.
func (a *App) BreakpointResume(pendingID string) {
	if a.breakpoint != nil {
		a.breakpoint.Resume(pendingID)
	}
}

// BreakpointDrop drops a paused request.
func (a *App) BreakpointDrop(pendingID string) {
	if a.breakpoint != nil {
		a.breakpoint.Drop(pendingID)
	}
}

// BreakpointPending represents a paused request for the frontend.
type BreakpointPending struct {
	ID     string `json:"id"`
	Method string `json:"method"`
	URL    string `json:"url"`
	Host   string `json:"host"`
	RuleID string `json:"rule_id"`
}

// GetPendingBreakpoints returns all currently paused requests.
func (a *App) GetPendingBreakpoints() []BreakpointPending {
	if a.breakpoint == nil {
		return []BreakpointPending{}
	}
	pending := a.breakpoint.PendingRequests()
	result := make([]BreakpointPending, 0, len(pending))
	for _, p := range pending {
		result = append(result, BreakpointPending{
			ID:     p.ID,
			Method: p.Request.Method,
			URL:    p.Request.URL.String(),
			Host:   p.Request.Host,
			RuleID: p.RuleID,
		})
	}
	return result
}

// ComposerRequest is the input for sending a custom HTTP request.
type ComposerRequest struct {
	Method  string            `json:"method"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
}

// ComposerResponse is the result of a custom HTTP request.
type ComposerResponse struct {
	StatusCode  int               `json:"status_code"`
	StatusText  string            `json:"status_text"`
	Headers     map[string]string `json:"headers"`
	Body        string            `json:"body"`
	BodySize    int64             `json:"body_size"`
	DurationMs  int64             `json:"duration_ms"`
}

// SendRequest sends a custom HTTP request and returns the response.
func (a *App) SendRequest(req ComposerRequest) (*ComposerResponse, error) {
	var bodyReader io.Reader
	if req.Body != "" {
		bodyReader = strings.NewReader(req.Body)
	}

	httpReq, err := http.NewRequestWithContext(a.ctx, req.Method, req.URL, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	for k, v := range req.Headers {
		httpReq.Header.Set(k, v)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	start := time.Now()

	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 32<<20))

	headers := make(map[string]string)
	for k, v := range resp.Header {
		headers[k] = strings.Join(v, ", ")
	}

	return &ComposerResponse{
		StatusCode: resp.StatusCode,
		StatusText: resp.Status,
		Headers:    headers,
		Body:       string(body),
		BodySize:   int64(len(body)),
		DurationMs: time.Since(start).Milliseconds(),
	}, nil
}

// HandleNewSession is called by the proxy when a new session is captured.
func (a *App) HandleNewSession(s *model.Session) {
	a.store.Add(s)

	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "coroxy:session:new", s)
	}
}
