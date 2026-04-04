package constant

// EngineState represents the proxy engine's running state.
type EngineState string

const (
	EngineStateUnknown  EngineState = "unknown"
	EngineStateStopped  EngineState = "stopped"
	EngineStateStarting EngineState = "starting"
	EngineStateRunning  EngineState = "running"
	EngineStateStopping EngineState = "stopping"
)

// SessionState represents the lifecycle state of a captured session.
type SessionState string

const (
	SessionStateUnknown   SessionState = "unknown"
	SessionStateActive    SessionState = "active"
	SessionStateCompleted SessionState = "completed"
	SessionStateError     SessionState = "error"
)
