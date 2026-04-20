package throttle

import (
	"bytes"
	"io"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestThrottler_SetConfig(t *testing.T) {
	tr := New()
	if got := tr.Config(); got != (Config{}) {
		t.Errorf("got %+v, want zero Config", got)
	}

	cfg := Config{BytesPerSec: 1000, Latency: 50 * time.Millisecond}
	tr.SetConfig(cfg)
	if got := tr.Config(); got != cfg {
		t.Errorf("got %+v, want %+v", got, cfg)
	}
}

func TestThrottler_Enabled(t *testing.T) {
	tests := []struct {
		name string
		cfg  Config
		want bool
	}{
		{"zero config disabled", Config{}, false},
		{"only latency disabled", Config{Latency: 100 * time.Millisecond}, false},
		{"bytes per sec enables", Config{BytesPerSec: 1}, true},
		{"preset 3G enabled", Preset3G, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tr := New()
			tr.SetConfig(tt.cfg)
			if got := tr.Enabled(); got != tt.want {
				t.Errorf("got %v, want %v", got, tt.want)
			}
		})
	}
}

func TestThrottler_WrapReader_DisabledReturnsOriginal(t *testing.T) {
	tr := New()
	src := strings.NewReader("hello")
	wrapped := tr.WrapReader(src)
	if wrapped != src {
		t.Errorf("disabled WrapReader should return original reader")
	}
}

func TestThrottler_WrapWriter_DisabledReturnsOriginal(t *testing.T) {
	tr := New()
	var buf bytes.Buffer
	wrapped := tr.WrapWriter(&buf)
	if wrapped != io.Writer(&buf) {
		t.Errorf("disabled WrapWriter should return original writer")
	}
}

func TestThrottler_WrapReader_EnabledReturnsThrottled(t *testing.T) {
	tr := New()
	tr.SetConfig(Config{BytesPerSec: 1000})
	src := strings.NewReader("hello")
	wrapped := tr.WrapReader(src)
	if _, ok := wrapped.(*throttledReader); !ok {
		t.Errorf("enabled WrapReader should return *throttledReader, got %T", wrapped)
	}
}

func TestThrottler_WrapWriter_EnabledReturnsThrottled(t *testing.T) {
	tr := New()
	tr.SetConfig(Config{BytesPerSec: 1000})
	var buf bytes.Buffer
	wrapped := tr.WrapWriter(&buf)
	if _, ok := wrapped.(*throttledWriter); !ok {
		t.Errorf("enabled WrapWriter should return *throttledWriter, got %T", wrapped)
	}
}

func TestThrottledReader_ChunkSizeLimited(t *testing.T) {
	// BytesPerSec=1000 → maxChunk = 100 bytes per Read call.
	src := strings.NewReader(strings.Repeat("x", 500))
	r := &throttledReader{r: src, cfg: Config{BytesPerSec: 1000}}

	buf := make([]byte, 500)
	n, err := r.Read(buf)
	if err != nil && err != io.EOF {
		t.Fatalf("read error: %v", err)
	}
	if n > 100 {
		t.Errorf("read %d bytes, want <= 100 (maxChunk)", n)
	}
}

func TestThrottledWriter_WritesAllBytes(t *testing.T) {
	var buf bytes.Buffer
	// Pick a fast preset so the test stays quick.
	w := &throttledWriter{w: &buf, cfg: Config{BytesPerSec: 1_000_000}}

	payload := []byte(strings.Repeat("x", 500))
	n, err := w.Write(payload)
	if err != nil {
		t.Fatalf("write error: %v", err)
	}
	if n != len(payload) {
		t.Errorf("wrote %d bytes, want %d", n, len(payload))
	}
	if buf.Len() != len(payload) {
		t.Errorf("buffer has %d bytes, want %d", buf.Len(), len(payload))
	}
}

func TestThrottledReader_AppliesLatency(t *testing.T) {
	src := strings.NewReader("x")
	latency := 30 * time.Millisecond
	r := &throttledReader{r: src, cfg: Config{BytesPerSec: 1_000_000, Latency: latency}}

	start := time.Now()
	buf := make([]byte, 1)
	if _, err := r.Read(buf); err != nil && err != io.EOF {
		t.Fatalf("read error: %v", err)
	}
	elapsed := time.Since(start)
	if elapsed < latency {
		t.Errorf("elapsed %v, want >= %v (latency)", elapsed, latency)
	}
}

func TestThrottledWriter_AppliesLatency(t *testing.T) {
	var buf bytes.Buffer
	latency := 30 * time.Millisecond
	w := &throttledWriter{w: &buf, cfg: Config{BytesPerSec: 1_000_000, Latency: latency}}

	start := time.Now()
	if _, err := w.Write([]byte("x")); err != nil {
		t.Fatalf("write error: %v", err)
	}
	elapsed := time.Since(start)
	if elapsed < latency {
		t.Errorf("elapsed %v, want >= %v (latency)", elapsed, latency)
	}
}

func TestThrottler_ConcurrentSetGet(t *testing.T) {
	tr := New()
	var wg sync.WaitGroup
	const goroutines = 16
	const iterations = 200

	for i := 0; i < goroutines; i++ {
		wg.Add(2)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < iterations; j++ {
				tr.SetConfig(Config{BytesPerSec: int64(id*100 + j)})
			}
		}(i)
		go func() {
			defer wg.Done()
			for j := 0; j < iterations; j++ {
				_ = tr.Config()
				_ = tr.Enabled()
			}
		}()
	}
	wg.Wait()
}
