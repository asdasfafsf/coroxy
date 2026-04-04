package session

import (
	"sort"
	"sync"

	"coroxy/internal/model"
)

// MemoryStore is a thread-safe in-memory session store.
type MemoryStore struct {
	mu       sync.RWMutex
	sessions map[string]*model.Session
}

// NewMemoryStore creates a new in-memory session store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		sessions: make(map[string]*model.Session),
	}
}

// Add stores a new session. Panics if session is nil.
func (s *MemoryStore) Add(session *model.Session) {
	if session == nil {
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.sessions[session.ID] = session
}

// Get returns a session by ID. Returns nil if not found.
func (s *MemoryStore) Get(id string) *model.Session {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.sessions[id]
}

// List returns all sessions ordered by creation time (newest first).
func (s *MemoryStore) List() []*model.Session {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*model.Session, 0, len(s.sessions))
	for _, session := range s.sessions {
		result = append(result, session)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].CreatedAt.After(result[j].CreatedAt)
	})

	return result
}

// Update replaces an existing session. Does nothing if the session does not exist or is nil.
func (s *MemoryStore) Update(session *model.Session) {
	if session == nil {
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.sessions[session.ID]; exists {
		s.sessions[session.ID] = session
	}
}

// Delete removes a session by ID.
func (s *MemoryStore) Delete(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.sessions, id)
}

// Clear removes all sessions.
func (s *MemoryStore) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.sessions = make(map[string]*model.Session)
}

// Count returns the number of stored sessions.
func (s *MemoryStore) Count() int {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return len(s.sessions)
}
