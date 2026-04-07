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

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"coroxy/internal/adapter"
	"coroxy/internal/intercept"
	"coroxy/internal/model"
	"coroxy/internal/proxy"
	"coroxy/internal/rule"
	"coroxy/internal/session"
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
}

// NewApp creates a new App with its dependencies.
func NewApp(engine adapter.ProxyEngine, store *session.MemoryStore, caManager adapter.CAManager, ruleEngine *rule.Engine, logger *slog.Logger) *App {
	return &App{
		engine:     engine,
		store:      store,
		caManager:  caManager,
		ruleEngine: ruleEngine,
		logger:     logger,
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

// StartProxy starts the proxy engine.
func (a *App) StartProxy() error {
	return a.engine.Start(a.ctx)
}

// StopProxy stops the proxy engine.
func (a *App) StopProxy() error {
	return a.engine.Stop(a.ctx)
}

// ProxyState returns the current proxy engine state.
func (a *App) ProxyState() string {
	return string(a.engine.State())
}

// Sessions returns all captured sessions.
func (a *App) Sessions() []*model.Session {
	return a.store.List()
}

// SessionsFiltered returns sessions matching the given filter.
func (a *App) SessionsFiltered(filter model.SessionFilter) []*model.Session {
	return a.store.ListWithFilter(filter)
}

// ClearSessions removes all captured sessions.
func (a *App) ClearSessions() {
	a.store.Clear()
	if a.autoSaver != nil {
		a.autoSaver.MarkDirty()
	}
}

// InstallCA installs the Root CA into the OS trust store.
func (a *App) InstallCA() error {
	return a.caManager.InstallCA()
}

// UninstallCA removes the Root CA from the OS trust store.
func (a *App) UninstallCA() error {
	return a.caManager.UninstallCA()
}

// CAInfo returns metadata about the Root CA.
func (a *App) CAInfo() model.CAInfo {
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

// ExportSessionsSAZ exports all HTTP sessions as SAZ to a user-selected file.
func (a *App) ExportSessionsSAZ() error {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Export SAZ",
		DefaultFilename: "coroxy.saz",
		Filters: []runtime.FileFilter{
			{DisplayName: "SAZ Files", Pattern: "*.saz"},
		},
	})
	if err != nil {
		return err
	}
	if path == "" {
		return nil
	}

	sessions := a.store.List()
	return session.ExportSAZ(path, sessions)
}

// ImportSessionsSAZ imports sessions from a user-selected SAZ file.
func (a *App) ImportSessionsSAZ() (int, error) {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Import SAZ",
		Filters: []runtime.FileFilter{
			{DisplayName: "SAZ Files", Pattern: "*.saz"},
		},
	})
	if err != nil {
		return 0, err
	}
	if path == "" {
		return 0, nil
	}

	sessions, err := session.ImportSAZ(path)
	if err != nil {
		return 0, fmt.Errorf("import SAZ: %w", err)
	}

	for _, s := range sessions {
		a.store.Add(s)
	}

	if a.autoSaver != nil {
		a.autoSaver.MarkDirtyN(len(sessions))
	}

	return len(sessions), nil
}

// ImportSessionsHAR imports sessions from a user-selected HAR file.
func (a *App) ImportSessionsHAR() (int, error) {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Import HAR",
		Filters: []runtime.FileFilter{
			{DisplayName: "HAR Files", Pattern: "*.har"},
		},
	})
	if err != nil {
		return 0, err
	}
	if path == "" {
		return 0, nil
	}

	sessions, err := session.ImportHAR(path)
	if err != nil {
		return 0, fmt.Errorf("import HAR: %w", err)
	}

	for _, s := range sessions {
		a.store.Add(s)
	}

	if a.autoSaver != nil {
		a.autoSaver.MarkDirtyN(len(sessions))
	}

	return len(sessions), nil
}

// TagSession adds or removes a tag on a session.
func (a *App) TagSession(sessionID string, tag string, remove bool) {
	s := a.store.Get(sessionID)
	if s == nil {
		return
	}
	if remove {
		filtered := make([]string, 0, len(s.Tags))
		for _, t := range s.Tags {
			if t != tag {
				filtered = append(filtered, t)
			}
		}
		s.Tags = filtered
	} else {
		for _, t := range s.Tags {
			if t == tag {
				return // already tagged
			}
		}
		s.Tags = append(s.Tags, tag)
	}
	if a.autoSaver != nil {
		a.autoSaver.MarkDirty()
	}
}

// CommentSession sets a comment on a session.
func (a *App) CommentSession(sessionID string, comment string) {
	s := a.store.Get(sessionID)
	if s == nil {
		return
	}
	s.Comment = comment
	if a.autoSaver != nil {
		a.autoSaver.MarkDirty()
	}
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

// PendingBreakpoints returns all currently paused requests.
func (a *App) PendingBreakpoints() []BreakpointPending {
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

	body, err := io.ReadAll(io.LimitReader(resp.Body, 32<<20))
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	headers := make(map[string]string)
	for k, v := range resp.Header {
		headers[k] = strings.Join(v, ", ")
	}

	return &ComposerResponse{
		StatusCode: resp.StatusCode,
		StatusText: http.StatusText(resp.StatusCode),
		Headers:    headers,
		Body:       string(body),
		BodySize:   int64(len(body)),
		DurationMs: time.Since(start).Milliseconds(),
	}, nil
}

// ReplaySession re-sends the request from an existing session and returns the response.
func (a *App) ReplaySession(sessionID string) (*ComposerResponse, error) {
	s := a.store.Get(sessionID)
	if s == nil {
		return nil, fmt.Errorf("session not found: %s", sessionID)
	}
	if s.Request == nil {
		return nil, fmt.Errorf("session has no request: %s", sessionID)
	}

	headers := make(map[string]string)
	for k, vs := range s.Request.Headers {
		if len(vs) > 0 {
			headers[k] = vs[0]
		}
	}

	req := ComposerRequest{
		Method:  s.Request.Method,
		URL:     s.Request.URL,
		Headers: headers,
		Body:    string(s.Request.Body),
	}

	return a.SendRequest(req)
}

// HandleNewSession is called by the proxy when a new session is captured.
func (a *App) HandleNewSession(s *model.Session) {
	a.store.Add(s)

	if a.autoSaver != nil {
		a.autoSaver.MarkDirty()
	}

	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "coroxy:session:new", s)
	}
}
