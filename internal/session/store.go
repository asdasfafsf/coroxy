package session

import (
	"sort"
	"strings"
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

// Add stores a new session. Does nothing if session is nil.
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

// ListWithFilter returns sessions matching the given filter, ordered by creation time (newest first).
func (s *MemoryStore) ListWithFilter(filter model.SessionFilter) []*model.Session {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*model.Session, 0)
	for _, session := range s.sessions {
		if matchSession(session, filter) {
			result = append(result, session)
		}
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

// snapshot returns a copy of all sessions without sorting.
// Used by AutoSaver where ordering is not needed.
func (s *MemoryStore) snapshot() []*model.Session {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*model.Session, 0, len(s.sessions))
	for _, session := range s.sessions {
		result = append(result, session)
	}
	return result
}

// matchSession checks if a session matches the filter criteria.
func matchSession(s *model.Session, f model.SessionFilter) bool {
	if f.Protocol != "" && s.Protocol != f.Protocol {
		return false
	}
	if f.Host != "" && !strings.Contains(strings.ToLower(s.Target.Host), strings.ToLower(f.Host)) {
		return false
	}
	if f.Method != "" && (s.Request == nil || !strings.EqualFold(s.Request.Method, f.Method)) {
		return false
	}
	if f.StatusCode != 0 && (s.Response == nil || s.Response.StatusCode != f.StatusCode) {
		return false
	}
	if f.State != "" && s.State != f.State {
		return false
	}
	if f.Query != "" {
		q := strings.ToLower(f.Query)
		matched := strings.Contains(strings.ToLower(s.Target.Host), q)
		if s.Request != nil {
			matched = matched || strings.Contains(strings.ToLower(s.Request.URL), q)
			matched = matched || strings.Contains(strings.ToLower(s.Request.Method), q)
		}
		if !matched {
			return false
		}
	}
	return true
}
