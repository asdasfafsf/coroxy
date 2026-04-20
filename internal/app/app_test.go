package app

import (
	"io"
	"log/slog"
	"testing"
	"time"

	"coroxy/internal/model"
	"coroxy/internal/session"
	"coroxy/internal/throttle"
)

// newTestApp constructs an App with real store + throttler and a discard logger.
// Wails-dependent fields (ctx, engine, caManager, ruleEngine, breakpoint) stay nil
// so only methods that don't touch them can be exercised.
func newTestApp(t *testing.T) *App {
	t.Helper()
	store := session.NewMemoryStore()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	return &App{
		store:     store,
		logger:    logger,
		throttler: throttle.New(),
	}
}

func seedSession(t *testing.T, a *App, id string) *model.Session {
	t.Helper()
	s := &model.Session{ID: id, CreatedAt: time.Now()}
	a.store.Add(s)
	return s
}

func TestApp_TagSession(t *testing.T) {
	tests := []struct {
		name      string
		startTags []string
		tag       string
		remove    bool
		wantTags  []string
	}{
		{"add new tag", nil, "important", false, []string{"important"}},
		{"add duplicate is no-op", []string{"important"}, "important", false, []string{"important"}},
		{"remove existing tag", []string{"a", "b", "c"}, "b", true, []string{"a", "c"}},
		{"remove only tag", []string{"only"}, "only", true, []string{}},
		{"remove non-existent tag", []string{"a"}, "missing", true, []string{"a"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a := newTestApp(t)
			s := seedSession(t, a, "s1")
			s.Tags = append([]string{}, tt.startTags...)

			a.TagSession("s1", tt.tag, tt.remove)

			got := a.store.Get("s1").Tags
			if len(got) != len(tt.wantTags) {
				t.Fatalf("got %v, want %v", got, tt.wantTags)
			}
			for i, want := range tt.wantTags {
				if got[i] != want {
					t.Errorf("got[%d] = %q, want %q", i, got[i], want)
				}
			}
		})
	}
}

func TestApp_TagSession_MissingSession_NoOp(t *testing.T) {
	a := newTestApp(t)
	// Should not panic on missing session.
	a.TagSession("does-not-exist", "x", false)
	a.TagSession("does-not-exist", "x", true)
}

func TestApp_CommentSession(t *testing.T) {
	a := newTestApp(t)
	seedSession(t, a, "s1")

	a.CommentSession("s1", "first comment")
	if got := a.store.Get("s1").Comment; got != "first comment" {
		t.Errorf("got %q, want %q", got, "first comment")
	}

	a.CommentSession("s1", "overwritten")
	if got := a.store.Get("s1").Comment; got != "overwritten" {
		t.Errorf("got %q, want %q", got, "overwritten")
	}
}

func TestApp_CommentSession_MissingSession_NoOp(t *testing.T) {
	a := newTestApp(t)
	a.CommentSession("missing", "ignored")
}

func TestApp_ThrottleState_PresetMapping(t *testing.T) {
	tests := []struct {
		name       string
		setPreset  string
		wantPreset string
		wantOn     bool
	}{
		{"off default", "off", "off", false},
		{"3g", "3g", "3g", true},
		{"4g", "4g", "4g", true},
		{"wifi", "wifi", "wifi", true},
		{"unknown falls back to off", "garbage", "off", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a := newTestApp(t)
			a.SetThrottle(tt.setPreset)

			cfg := a.ThrottleState()
			if cfg.Preset != tt.wantPreset {
				t.Errorf("Preset = %q, want %q", cfg.Preset, tt.wantPreset)
			}
			if cfg.Enabled != tt.wantOn {
				t.Errorf("Enabled = %v, want %v", cfg.Enabled, tt.wantOn)
			}
		})
	}
}

func TestApp_HandleNewSession_NoCtx_AddsToStore(t *testing.T) {
	a := newTestApp(t)
	// ctx is nil, so EventsEmit branch is skipped — store.Add still runs.
	s := &model.Session{ID: "n1", CreatedAt: time.Now()}
	a.HandleNewSession(s)

	if got := a.store.Get("n1"); got == nil {
		t.Fatal("session not added to store")
	}
}

func TestApp_HandleNewSession_NilSession_NoOp(t *testing.T) {
	a := newTestApp(t)
	// MemoryStore.Add is nil-safe; verify HandleNewSession doesn't panic either.
	a.HandleNewSession(nil)
}
