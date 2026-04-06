package session

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestDefaultStoragePolicy(t *testing.T) {
	p := DefaultStoragePolicy()

	if p.MaxSessions != 5000 {
		t.Errorf("MaxSessions: got %d, want 5000", p.MaxSessions)
	}
	if p.MaxBytes != 500<<20 {
		t.Errorf("MaxBytes: got %d, want %d", p.MaxBytes, 500<<20)
	}
	if p.MaxAge != 7*24*time.Hour {
		t.Errorf("MaxAge: got %v, want 7d", p.MaxAge)
	}
	if p.MaxArchives != 10 {
		t.Errorf("MaxArchives: got %d, want 10", p.MaxArchives)
	}
}

func TestNeedsRotation(t *testing.T) {
	p := StoragePolicy{MaxSessions: 100, MaxBytes: 1024, MaxArchives: 5, MaxAge: time.Hour}

	tests := []struct {
		name         string
		fileSize     int64
		sessionCount int
		want         bool
	}{
		{"under limits", 512, 50, false},
		{"over size", 2048, 50, true},
		{"over sessions", 512, 200, true},
		{"both over", 2048, 200, true},
		{"at limit size", 1024, 100, false},
		{"just over size", 1025, 100, true},
		{"just over sessions", 1024, 101, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := p.NeedsRotation(tt.fileSize, tt.sessionCount)
			if got != tt.want {
				t.Errorf("got %v, want %v", got, tt.want)
			}
		})
	}
}

func TestEnforceRotation(t *testing.T) {
	dir := t.TempDir()
	currentName := "sessions.csaz"

	// Create the current archive file.
	currentPath := filepath.Join(dir, currentName)
	if err := os.WriteFile(currentPath, []byte("current"), 0644); err != nil {
		t.Fatal(err)
	}

	// Create some old rotated archives.
	for i := 0; i < 3; i++ {
		name := filepath.Join(dir, "sessions-20260401-12000"+string(rune('0'+i))+".csaz")
		if err := os.WriteFile(name, []byte("old"), 0644); err != nil {
			t.Fatal(err)
		}
	}

	p := StoragePolicy{MaxSessions: 5000, MaxBytes: 500 << 20, MaxAge: 7 * 24 * time.Hour, MaxArchives: 2}

	if err := p.EnforceRotation(dir, currentName); err != nil {
		t.Fatalf("enforce rotation: %v", err)
	}

	// Current file should be renamed.
	if _, err := os.Stat(currentPath); !os.IsNotExist(err) {
		t.Error("current file should have been renamed")
	}

	// Count remaining .csaz files.
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	var csazCount int
	for _, e := range entries {
		if filepath.Ext(e.Name()) == ".csaz" {
			csazCount++
		}
	}

	// MaxArchives=2, so at most 2 rotated archives remain.
	if csazCount > 2 {
		t.Errorf("archives: got %d, want <= 2", csazCount)
	}
}

func TestEnforceRotationNoCurrentFile(t *testing.T) {
	dir := t.TempDir()

	p := DefaultStoragePolicy()

	// Should not error when current file doesn't exist.
	if err := p.EnforceRotation(dir, "sessions.csaz"); err != nil {
		t.Fatalf("enforce rotation: %v", err)
	}
}
