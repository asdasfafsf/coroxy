package proxy

import (
	"context"
	"log/slog"
	"testing"
	"time"

	"coroxy/internal/constant"
	"coroxy/internal/model"
)

func newTestEngine(t *testing.T) *Engine {
	t.Helper()

	config := model.ProxyConfig{
		HTTPAddr:  ":0", // OS assigns a free port
		SOCKSAddr: ":0",
	}
	logger := slog.Default()

	return NewEngine(config, logger, nil, nil, nil)
}

func TestEngineStartStop(t *testing.T) {
	e := newTestEngine(t)

	if got := e.State(); got != constant.EngineStateStopped {
		t.Fatalf("initial state: got %s, want %s", got, constant.EngineStateStopped)
	}

	ctx := context.Background()

	if err := e.Start(ctx); err != nil {
		t.Fatalf("start: %v", err)
	}

	if got := e.State(); got != constant.EngineStateRunning {
		t.Fatalf("after start: got %s, want %s", got, constant.EngineStateRunning)
	}

	stopCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := e.Stop(stopCtx); err != nil {
		t.Fatalf("stop: %v", err)
	}

	if got := e.State(); got != constant.EngineStateStopped {
		t.Fatalf("after stop: got %s, want %s", got, constant.EngineStateStopped)
	}
}

func TestEngineDoubleStart(t *testing.T) {
	e := newTestEngine(t)
	ctx := context.Background()

	if err := e.Start(ctx); err != nil {
		t.Fatalf("first start: %v", err)
	}
	defer func() {
		stopCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()
		_ = e.Stop(stopCtx)
	}()

	if err := e.Start(ctx); err == nil {
		t.Fatal("second start: expected error, got nil")
	}
}

func TestEngineStopWithoutStart(t *testing.T) {
	e := newTestEngine(t)

	if err := e.Stop(context.Background()); err == nil {
		t.Fatal("stop without start: expected error, got nil")
	}
}

func TestEngineConfig(t *testing.T) {
	config := model.ProxyConfig{
		HTTPAddr:  ":9090",
		SOCKSAddr: ":1090",
	}
	e := NewEngine(config, slog.Default(), nil, nil, nil)

	got := e.Config()
	if got.HTTPAddr != config.HTTPAddr {
		t.Fatalf("HTTPAddr: got %s, want %s", got.HTTPAddr, config.HTTPAddr)
	}
	if got.SOCKSAddr != config.SOCKSAddr {
		t.Fatalf("SOCKSAddr: got %s, want %s", got.SOCKSAddr, config.SOCKSAddr)
	}
}
