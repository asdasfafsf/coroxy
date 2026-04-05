package session

import (
	"os"
	"testing"
	"time"

	"coroxy/internal/constant"
	"coroxy/internal/model"
)

func TestPersistAndLoad(t *testing.T) {
	// Use temp dir for test.
	tmpDir := t.TempDir()
	origFunc := sessionsDir
	sessionsDir = func() (string, error) { return tmpDir, nil }
	defer func() { sessionsDir = origFunc }()

	// Create store with sessions.
	store := NewMemoryStore()
	store.Add(&model.Session{
		ID:        "s1",
		Protocol:  constant.ProtocolHTTP,
		Target:    model.Endpoint{Host: "example.com", Port: 80},
		State:     constant.SessionStateCompleted,
		CreatedAt: time.Now(),
		Duration:  100 * time.Millisecond,
		Request: &model.HTTPMessage{
			Method: "GET",
			URL:    "http://example.com/test",
		},
	})
	store.Add(&model.Session{
		ID:       "s2",
		Protocol: constant.ProtocolTCP,
		Target:   model.Endpoint{Host: "db.local", Port: 5432},
		State:    constant.SessionStateCompleted,
	})

	// Persist.
	if err := store.Persist(); err != nil {
		t.Fatalf("persist: %v", err)
	}

	// Verify file exists.
	if _, err := os.Stat(tmpDir + "/sessions.json"); err != nil {
		t.Fatalf("sessions.json not found: %v", err)
	}

	// Load into a new store.
	store2 := NewMemoryStore()
	if err := store2.Load(); err != nil {
		t.Fatalf("load: %v", err)
	}

	if store2.Count() != 2 {
		t.Fatalf("count: got %d, want 2", store2.Count())
	}

	s1 := store2.Get("s1")
	if s1 == nil {
		t.Fatal("session s1 not found")
	}
	if s1.Request == nil || s1.Request.Method != "GET" {
		t.Fatal("session s1 request not preserved")
	}
	if s1.Target.Host != "example.com" {
		t.Fatalf("host: got %s, want example.com", s1.Target.Host)
	}
}

func TestLoadNoFile(t *testing.T) {
	tmpDir := t.TempDir()
	origFunc := sessionsDir
	sessionsDir = func() (string, error) { return tmpDir, nil }
	defer func() { sessionsDir = origFunc }()

	store := NewMemoryStore()
	if err := store.Load(); err != nil {
		t.Fatalf("load with no file should not error: %v", err)
	}
	if store.Count() != 0 {
		t.Fatalf("count: got %d, want 0", store.Count())
	}
}
