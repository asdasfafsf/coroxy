package session

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"
)

// AutoSaver periodically flushes dirty sessions to a .csaz archive.
// It uses a dual trigger: flush after N dirty sessions OR after a time interval.
type AutoSaver struct {
	store   *MemoryStore
	policy  StoragePolicy
	logger  *slog.Logger
	dirtyFn func() string // returns archive path

	interval       time.Duration
	dirtyThreshold int

	mu      sync.Mutex
	flushMu sync.Mutex
	dirty   atomic.Int64
	flushCh chan struct{} // non-blocking gate for threshold flush
	stopCh  chan struct{}
	stopped bool
	wg      sync.WaitGroup
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
func NewAutoSaver(store *MemoryStore, policy StoragePolicy, logger *slog.Logger, dirtyFn func() string, opts ...AutoSaveOption) (*AutoSaver, error) {
	if store == nil {
		return nil, fmt.Errorf("create autosaver: store is nil")
	}
	if logger == nil {
		return nil, fmt.Errorf("create autosaver: logger is nil")
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
		flushCh:        make(chan struct{}, 1),
		stopCh:         make(chan struct{}),
	}

	for _, opt := range opts {
		opt(a)
	}

	return a, nil
}

// Start begins the background auto-save goroutine.
func (a *AutoSaver) Start() {
	a.wg.Add(1)
	go func() {
		defer a.wg.Done()
		a.run()
	}()
}

// MarkDirty increments the dirty counter by 1. If the threshold is reached, triggers a flush.
func (a *AutoSaver) MarkDirty() {
	a.MarkDirtyN(1)
}

// MarkDirtyN increments the dirty counter by n. If the threshold is reached, triggers a flush.
// Uses a non-blocking channel send to limit to one pending threshold goroutine.
func (a *AutoSaver) MarkDirtyN(count int) {
	n := a.dirty.Add(int64(count))
	if int(n) >= a.dirtyThreshold {
		a.mu.Lock()
		stopped := a.stopped
		a.mu.Unlock()
		if stopped {
			return
		}
		select {
		case a.flushCh <- struct{}{}:
			a.wg.Add(1)
			go func() {
				defer a.wg.Done()
				a.flush("threshold")
				<-a.flushCh
			}()
		default:
			// flush already pending
		}
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

	a.wg.Wait()

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
	// Serialize flushes to avoid temp file races.
	a.flushMu.Lock()
	defer a.flushMu.Unlock()

	// Reset dirty counter after acquiring lock to prevent races
	// between concurrent threshold and timer flushes.
	n := a.dirty.Swap(0)
	if n == 0 {
		return nil // nothing changed
	}

	path := a.dirtyFn()
	sessions := a.store.snapshot()

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

	// Check rotation after successful write.
	info, err := os.Stat(path)
	if err == nil && a.policy.NeedsRotation(info.Size(), len(sessions)) {
		dir := filepath.Dir(path)
		base := filepath.Base(path)
		if err := a.policy.EnforceRotation(dir, base); err != nil {
			a.logger.Error("enforce rotation", slog.String("error", err.Error()))
		}
	}

	return nil
}
