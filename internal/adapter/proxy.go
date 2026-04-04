package adapter

import (
	"context"

	"coroxy/internal/constant"
	"coroxy/internal/model"
)

// SessionCallback is called when a new session is captured.
type SessionCallback func(session *model.Session)

// ProxyEngine defines the interface for controlling the proxy engine.
type ProxyEngine interface {
	// Start begins listening on configured addresses.
	Start(ctx context.Context) error

	// Stop gracefully shuts down all listeners.
	Stop(ctx context.Context) error

	// State returns the current engine state.
	State() constant.EngineState

	// Config returns the current proxy configuration.
	Config() model.ProxyConfig
}
