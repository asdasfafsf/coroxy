package adapter

import (
	"coroxy/internal/model"
)

// SessionStore defines the interface for storing and retrieving sessions.
type SessionStore interface {
	// Add stores a new session.
	Add(session *model.Session)

	// Get returns a session by ID. Returns nil if not found.
	Get(id string) *model.Session

	// List returns all sessions ordered by creation time (newest first).
	List() []*model.Session

	// Update replaces an existing session. Does nothing if the session does not exist.
	Update(session *model.Session)

	// Delete removes a session by ID.
	Delete(id string)

	// Clear removes all sessions.
	Clear()

	// Count returns the number of stored sessions.
	Count() int
}
