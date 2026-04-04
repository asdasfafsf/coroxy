package constant

// EngineState represents the proxy engine's running state.
type EngineState string

const (
	EngineStateStopped  EngineState = "stopped"
	EngineStateStarting EngineState = "starting"
	EngineStateRunning  EngineState = "running"
	EngineStateStopping EngineState = "stopping"
)

// SessionState represents the lifecycle state of a captured session.
type SessionState string

const (
	SessionStateActive    SessionState = "active"
	SessionStateCompleted SessionState = "completed"
	SessionStateError     SessionState = "error"
)
