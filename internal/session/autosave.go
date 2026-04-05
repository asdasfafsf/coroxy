package session

import (
	"fmt"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"

	"coroxy/internal/model"
)

// AutoSaver periodically flushes dirty sessions to a .csaz archive.
// It uses a dual trigger: flush after N dirty sessions OR after a time interval.
type AutoSaver struct {
	store    *MemoryStore
	policy   StoragePolicy
	logger   *slog.Logger
	dirtyFn  func() string // returns archive path

	interval      time.Duration
	dirtyThreshold int

	mu       sync.Mutex
	flushMu  sync.Mutex
	dirty    atomic.Int64
	stopCh   chan struct{}
	stopped  bool
}

// AutoSaveOption configures an AutoSaver.
type AutoSaveOption func(*AutoSaver)

// WithInterval sets the time-based flush interval.
func WithInterval(d time.Duration) AutoSaveOption {
	return func(a *AutoSaver) { a.interval = d }
}

// WithDirtyThreshold sets the session count that triggers a flush.
func WithDirtyThreshold(n int) AutoSaveOption {
	return func(a *AutoSaver) { a.dirtyThreshold = n }
}

// NewAutoSaver creates an AutoSaver.
// dirtyFn returns the archive file path for writing.
func NewAutoSaver(store *MemoryStore, policy StoragePolicy, logger *slog.Logger, dirtyFn func() string, opts ...AutoSaveOption) *AutoSaver {
	if store == nil {
		panic("session: NewAutoSaver requires non-nil store")
	}
	if logger == nil {
		panic("session: NewAutoSaver requires non-nil logger")
	}
	if dirtyFn == nil {
		panic("session: NewAutoSaver requires non-nil dirtyFn")
	}

	a := &AutoSaver{
		store:          store,
		policy:         policy,
		logger:         logger,
		dirtyFn:        dirtyFn,
		interval:       30 * time.Second,
		dirtyThreshold: 50,
		stopCh:         make(chan struct{}),
	}

	for _, opt := range opts {
		opt(a)
	}

	return a
}

// Start begins the background auto-save goroutine.
func (a *AutoSaver) Start() {
	go a.run()
}

// MarkDirty increments the dirty counter. If the threshold is reached, triggers a flush.
func (a *AutoSaver) MarkDirty() {
	n := a.dirty.Add(1)
	if int(n) >= a.dirtyThreshold {
		go a.flush("threshold")
	}
}

// Flush performs a final flush. Call this on shutdown.
func (a *AutoSaver) Flush() error {
	return a.doFlush("shutdown")
}

// Stop stops the background goroutine and performs a final flush.
func (a *AutoSaver) Stop() error {
	a.mu.Lock()
	if a.stopped {
		a.mu.Unlock()
		return nil
	}
	a.stopped = true
	close(a.stopCh)
	a.mu.Unlock()

	return a.Flush()
}

func (a *AutoSaver) run() {
	ticker := time.NewTicker(a.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			a.flush("timer")
		case <-a.stopCh:
			return
		}
	}
}

func (a *AutoSaver) flush(reason string) {
	if err := a.doFlush(reason); err != nil {
		a.logger.Error("autosave flush", slog.String("reason", reason), slog.String("error", err.Error()))
	}
}

func (a *AutoSaver) doFlush(reason string) error {
	// Reset dirty counter.
	n := a.dirty.Swap(0)
	if n == 0 {
		return nil // nothing changed
	}

	// Serialize flushes to avoid temp file races.
	a.flushMu.Lock()
	defer a.flushMu.Unlock()

	path := a.dirtyFn()

	a.store.mu.RLock()
	sessions := make([]*model.Session, 0, len(a.store.sessions))
	for _, s := range a.store.sessions {
		sessions = append(sessions, s)
	}
	a.store.mu.RUnlock()

	if err := WriteArchive(path, sessions); err != nil {
		// Restore dirty count since flush failed.
		a.dirty.Add(n)
		return fmt.Errorf("write archive: %w", err)
	}

	a.logger.Debug("autosave flushed",
		slog.String("reason", reason),
		slog.Int64("dirty", n),
		slog.Int("sessions", len(sessions)),
	)

	return nil
}
