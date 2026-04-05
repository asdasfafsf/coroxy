package session

import (
	"encoding/json"
	"os"
	"path/filepath"
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

	// Persist as .csaz.
	if err := store.Persist(); err != nil {
		t.Fatalf("persist: %v", err)
	}

	// Verify .csaz file exists.
	if _, err := os.Stat(filepath.Join(tmpDir, archiveFileName)); err != nil {
		t.Fatalf("archive not found: %v", err)
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

func TestLoadLegacyJSONFallback(t *testing.T) {
	tmpDir := t.TempDir()
	origFunc := sessionsDir
	sessionsDir = func() (string, error) { return tmpDir, nil }
	defer func() { sessionsDir = origFunc }()

	// Write a legacy sessions.json file.
	sessions := []*model.Session{
		{
			ID:       "legacy1",
			Protocol: constant.ProtocolHTTP,
			Target:   model.Endpoint{Host: "old.example.com", Port: 80},
			State:    constant.SessionStateCompleted,
			Request: &model.HTTPMessage{
				Method: "GET",
				URL:    "http://old.example.com/",
				Body:   []byte("hello"),
			},
		},
	}
	data, err := json.Marshal(sessions)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(tmpDir, legacyFileName), data, 0644); err != nil {
		t.Fatal(err)
	}

	// Load should use legacy JSON.
	store := NewMemoryStore()
	if err := store.Load(); err != nil {
		t.Fatalf("load legacy: %v", err)
	}

	if store.Count() != 1 {
		t.Fatalf("count: got %d, want 1", store.Count())
	}

	s := store.Get("legacy1")
	if s == nil {
		t.Fatal("legacy session not found")
	}
	if s.Target.Host != "old.example.com" {
		t.Errorf("host: got %s, want old.example.com", s.Target.Host)
	}
}

func TestLoadPrefersArchiveOverJSON(t *testing.T) {
	tmpDir := t.TempDir()
	origFunc := sessionsDir
	sessionsDir = func() (string, error) { return tmpDir, nil }
	defer func() { sessionsDir = origFunc }()

	// Write both .csaz and .json files.
	archiveSessions := []*model.Session{
		{
			ID:       "archive-s1",
			Protocol: constant.ProtocolHTTP,
			Target:   model.Endpoint{Host: "new.example.com", Port: 443},
			State:    constant.SessionStateCompleted,
		},
	}
	if err := WriteArchive(filepath.Join(tmpDir, archiveFileName), archiveSessions); err != nil {
		t.Fatal(err)
	}

	legacySessions := []*model.Session{
		{
			ID:       "json-s1",
			Protocol: constant.ProtocolHTTP,
			Target:   model.Endpoint{Host: "old.example.com", Port: 80},
			State:    constant.SessionStateCompleted,
		},
	}
	data, _ := json.Marshal(legacySessions)
	if err := os.WriteFile(filepath.Join(tmpDir, legacyFileName), data, 0644); err != nil {
		t.Fatal(err)
	}

	// Load should prefer .csaz.
	store := NewMemoryStore()
	if err := store.Load(); err != nil {
		t.Fatalf("load: %v", err)
	}

	if store.Count() != 1 {
		t.Fatalf("count: got %d, want 1", store.Count())
	}

	if s := store.Get("archive-s1"); s == nil {
		t.Error("should have loaded from archive, not JSON")
	}
	if s := store.Get("json-s1"); s != nil {
		t.Error("should not have loaded from JSON when archive exists")
	}
}

func TestArchivePath(t *testing.T) {
	tmpDir := t.TempDir()
	origFunc := sessionsDir
	sessionsDir = func() (string, error) { return tmpDir, nil }
	defer func() { sessionsDir = origFunc }()

	store := NewMemoryStore()
	path, err := store.ArchivePath()
	if err != nil {
		t.Fatalf("archive path: %v", err)
	}

	expected := filepath.Join(tmpDir, archiveFileName)
	if path != expected {
		t.Errorf("got %s, want %s", path, expected)
	}
}
