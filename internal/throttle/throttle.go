// Package throttle provides bandwidth-limited io.Reader and io.Writer wrappers.
package throttle

import (
	"io"
	"sync"
	"time"
)

// Config holds throttling parameters.
type Config struct {
	// BytesPerSec is the maximum transfer rate in bytes per second.
	// Zero means no throttling.
	BytesPerSec int64
	// Latency is the additional delay added to each read/write operation.
	Latency time.Duration
}

// Preset configurations simulating common network conditions.
var (
	// Off disables throttling.
	Off = Config{}
	// Preset3G simulates a 3G connection (~750 kbps).
	Preset3G = Config{BytesPerSec: 93750, Latency: 100 * time.Millisecond}
	// Preset4G simulates a 4G connection (~4 Mbps).
	Preset4G = Config{BytesPerSec: 500000, Latency: 20 * time.Millisecond}
	// PresetWiFi simulates a fast WiFi connection (~30 Mbps).
	PresetWiFi = Config{BytesPerSec: 3750000, Latency: 2 * time.Millisecond}
)

// Throttler manages the current throttling configuration.
type Throttler struct {
	mu     sync.RWMutex
	config Config
}

// New creates a new Throttler with no throttling.
func New() *Throttler {
	return &Throttler{}
}

// SetConfig updates the throttling configuration.
func (t *Throttler) SetConfig(cfg Config) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.config = cfg
}

// Config returns the current throttling configuration.
func (t *Throttler) GetConfig() Config {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.config
}

// Enabled returns true if throttling is active.
func (t *Throttler) Enabled() bool {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.config.BytesPerSec > 0
}

// WrapReader wraps r with bandwidth throttling based on the current config.
// If throttling is disabled, returns r unchanged.
func (t *Throttler) WrapReader(r io.Reader) io.Reader {
	cfg := t.GetConfig()
	if cfg.BytesPerSec <= 0 {
		return r
	}
	return &throttledReader{r: r, cfg: cfg}
}

// WrapWriter wraps w with bandwidth throttling based on the current config.
// If throttling is disabled, returns w unchanged.
func (t *Throttler) WrapWriter(w io.Writer) io.Writer {
	cfg := t.GetConfig()
	if cfg.BytesPerSec <= 0 {
		return w
	}
	return &throttledWriter{w: w, cfg: cfg}
}

type throttledReader struct {
	r   io.Reader
	cfg Config
}

func (tr *throttledReader) Read(p []byte) (int, error) {
	if tr.cfg.Latency > 0 {
		time.Sleep(tr.cfg.Latency)
	}

	// Limit chunk size to enforce rate
	maxChunk := tr.cfg.BytesPerSec / 10 // 100ms worth of data
	if maxChunk <= 0 {
		maxChunk = 1
	}
	if int64(len(p)) > maxChunk {
		p = p[:maxChunk]
	}

	n, err := tr.r.Read(p)
	if n > 0 && tr.cfg.BytesPerSec > 0 {
		delay := time.Duration(float64(n) / float64(tr.cfg.BytesPerSec) * float64(time.Second))
		time.Sleep(delay)
	}
	return n, err
}

type throttledWriter struct {
	w   io.Writer
	cfg Config
}

func (tw *throttledWriter) Write(p []byte) (int, error) {
	if tw.cfg.Latency > 0 {
		time.Sleep(tw.cfg.Latency)
	}

	total := 0
	maxChunk := tw.cfg.BytesPerSec / 10
	if maxChunk <= 0 {
		maxChunk = 1
	}

	for len(p) > 0 {
		chunk := p
		if int64(len(chunk)) > maxChunk {
			chunk = chunk[:maxChunk]
		}
		n, err := tw.w.Write(chunk)
		total += n
		if err != nil {
			return total, err
		}
		p = p[n:]
		if n > 0 && tw.cfg.BytesPerSec > 0 {
			delay := time.Duration(float64(n) / float64(tw.cfg.BytesPerSec) * float64(time.Second))
			time.Sleep(delay)
		}
	}
	return total, nil
}
