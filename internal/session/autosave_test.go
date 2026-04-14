package session

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"coroxy/internal/constant"
	"coroxy/internal/model"
)

func TestAutoSaverFlushOnThreshold(t *testing.T) {
	dir := t.TempDir()
	archivePath := filepath.Join(dir, "sessions.csaz")

	store := NewMemoryStore()
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelDebug}))

	var flushCount atomic.Int32

	saver, err := NewAutoSaver(
		store,
		DefaultStoragePolicy(),
		logger,
		func() string {
			flushCount.Add(1)
			return archivePath
		},
		WithDirtyThreshold(3),
		WithInterval(time.Hour), // disable timer-based flush for this test
	)
	if err != nil {
		t.Fatalf("new autosaver: %v", err)
	}
	saver.Start()
	defer func() { _ = saver.Stop() }()

	// Add sessions and mark dirty.
	for i := 0; i < 3; i++ {
		store.Add(&model.Session{
			ID:       fmt.Sprintf("s%d", i),
			Protocol: constant.ProtocolHTTP,
			Target:   model.Endpoint{Host: "example.com", Port: 80},
			State:    constant.SessionStateCompleted,
		})
		saver.MarkDirty()
	}

	// Wait for threshold flush.
	time.Sleep(200 * time.Millisecond)

	if flushCount.Load() < 1 {
		t.Error("expected at least 1 flush from threshold trigger")
	}

	// Verify archive is readable.
	loaded, err := ReadArchive(archivePath)
	if err != nil {
		t.Fatalf("read archive: %v", err)
	}
	if len(loaded) != 3 {
		t.Errorf("sessions: got %d, want 3", len(loaded))
	}
}

func TestAutoSaverFlushOnTimer(t *testing.T) {
	dir := t.TempDir()
	archivePath := filepath.Join(dir, "sessions.csaz")

	store := NewMemoryStore()
	store.Add(&model.Session{
		ID:       "timer-s1",
		Protocol: constant.ProtocolHTTP,
		Target:   model.Endpoint{Host: "example.com", Port: 80},
		State:    constant.SessionStateCompleted,
	})

	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelDebug}))

	saver, err := NewAutoSaver(
		store,
		DefaultStoragePolicy(),
		logger,
		func() string { return archivePath },
		WithInterval(100*time.Millisecond),
		WithDirtyThreshold(1000), // high threshold to avoid threshold trigger
	)
	if err != nil {
		t.Fatalf("new autosaver: %v", err)
	}
	saver.Start()

	// Mark dirty once (below threshold).
	saver.MarkDirty()

	// Wait for timer flush.
	time.Sleep(300 * time.Millisecond)

	_ = saver.Stop()

	// Verify archive was written.
	loaded, err := ReadArchive(archivePath)
	if err != nil {
		t.Fatalf("read archive: %v", err)
	}
	if len(loaded) != 1 {
		t.Errorf("sessions: got %d, want 1", len(loaded))
	}
}

func TestAutoSaverTimerSkipsCleanState(t *testing.T) {
	dir := t.TempDir()
	archivePath := filepath.Join(dir, "sessions.csaz")

	store := NewMemoryStore()
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelDebug}))

	saver, err := NewAutoSaver(
		store,
		DefaultStoragePolicy(),
		logger,
		func() string { return archivePath },
		WithInterval(100*time.Millisecond),
		WithDirtyThreshold(1000),
	)
	if err != nil {
		t.Fatalf("new autosaver: %v", err)
	}
	saver.Start()

	// Don't mark dirty — timer should skip flush.
	time.Sleep(300 * time.Millisecond)
	_ = saver.Stop()

	// Archive should not exist (no dirty data).
	if _, err := os.Stat(archivePath); !os.IsNotExist(err) {
		t.Error("archive should not exist when nothing is dirty")
	}
}

func TestAutoSaverShutdownFlush(t *testing.T) {
	dir := t.TempDir()
	archivePath := filepath.Join(dir, "sessions.csaz")

	store := NewMemoryStore()
	store.Add(&model.Session{
		ID:       "shutdown-s1",
		Protocol: constant.ProtocolHTTP,
		State:    constant.SessionStateCompleted,
	})

	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelDebug}))

	saver, err := NewAutoSaver(
		store,
		DefaultStoragePolicy(),
		logger,
		func() string { return archivePath },
		WithInterval(time.Hour),    // no timer flush
		WithDirtyThreshold(1000),   // no threshold flush
	)
	if err != nil {
		t.Fatalf("new autosaver: %v", err)
	}
	saver.Start()
	saver.MarkDirty()

	// Stop should flush.
	if err := saver.Stop(); err != nil {
		t.Fatalf("stop: %v", err)
	}

	loaded, err := ReadArchive(archivePath)
	if err != nil {
		t.Fatalf("read archive: %v", err)
	}
	if len(loaded) != 1 {
		t.Errorf("sessions: got %d, want 1", len(loaded))
	}
}

func TestAutoSaverConcurrency(t *testing.T) {
	dir := t.TempDir()
	archivePath := filepath.Join(dir, "sessions.csaz")

	store := NewMemoryStore()
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelDebug}))

	saver, err := NewAutoSaver(
		store,
		DefaultStoragePolicy(),
		logger,
		func() string { return archivePath },
		WithInterval(50*time.Millisecond),
		WithDirtyThreshold(10),
	)
	if err != nil {
		t.Fatalf("new autosaver: %v", err)
	}
	saver.Start()

	// Concurrent session adds.
	done := make(chan struct{})
	for i := 0; i < 50; i++ {
		go func(n int) {
			store.Add(&model.Session{
				ID:       fmt.Sprintf("c%d", n),
				Protocol: constant.ProtocolHTTP,
				State:    constant.SessionStateCompleted,
			})
			saver.MarkDirty()
		}(i)
	}

	time.Sleep(500 * time.Millisecond)
	close(done)

	if err := saver.Stop(); err != nil {
		t.Fatalf("stop: %v", err)
	}

	// Archive should be readable with all sessions.
	loaded, err := ReadArchive(archivePath)
	if err != nil {
		t.Fatalf("read archive: %v", err)
	}
	if len(loaded) != store.Count() {
		t.Errorf("sessions: got %d, want %d", len(loaded), store.Count())
	}
}
