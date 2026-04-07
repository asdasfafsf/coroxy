package constant

// EngineState represents the proxy engine's running state.
type EngineState string

const (
	// EngineStateUnknown is the zero value for engine state.
	EngineStateUnknown EngineState = "unknown"
	// EngineStateStopped indicates the engine is not running.
	EngineStateStopped EngineState = "stopped"
	// EngineStateStarting indicates the engine is in the process of starting up.
	EngineStateStarting EngineState = "starting"
	// EngineStateRunning indicates the engine is actively listening and proxying traffic.
	EngineStateRunning EngineState = "running"
	// EngineStateStopping indicates the engine is in the process of shutting down.
	EngineStateStopping EngineState = "stopping"
)

// SessionState represents the lifecycle state of a captured session.
type SessionState string

const (
	// SessionStateUnknown is the zero value for session state.
	SessionStateUnknown SessionState = "unknown"
	// SessionStateActive indicates the session is currently in progress.
	SessionStateActive SessionState = "active"
	// SessionStateCompleted indicates the session finished successfully.
	SessionStateCompleted SessionState = "completed"
	// SessionStateError indicates the session ended with an error.
	SessionStateError SessionState = "error"
)
