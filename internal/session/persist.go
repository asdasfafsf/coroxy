package session

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"coroxy/internal/model"
)

// sessionsDir is a package-level variable for testing.
var sessionsDir = SessionsDir

// Persist saves all sessions in the store to disk as a single JSON file.
func (s *MemoryStore) Persist() error {
	dir, err := sessionsDir()
	if err != nil {
		return fmt.Errorf("get sessions dir: %w", err)
	}

	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("create sessions dir: %w", err)
	}

	s.mu.RLock()
	sessions := make([]*model.Session, 0, len(s.sessions))
	for _, sess := range s.sessions {
		sessions = append(sessions, sess)
	}
	s.mu.RUnlock()

	data, err := json.Marshal(sessions)
	if err != nil {
		return fmt.Errorf("marshal sessions: %w", err)
	}

	filePath := filepath.Join(dir, "sessions.json")

	// Write to temp file then rename for atomic write.
	tmpPath := filePath + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return fmt.Errorf("write sessions file: %w", err)
	}
	if err := os.Rename(tmpPath, filePath); err != nil {
		return fmt.Errorf("rename sessions file: %w", err)
	}

	return nil
}

// Load reads sessions from disk and populates the store.
func (s *MemoryStore) Load() error {
	dir, err := sessionsDir()
	if err != nil {
		return fmt.Errorf("get sessions dir: %w", err)
	}

	filePath := filepath.Join(dir, "sessions.json")

	data, err := os.ReadFile(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // no saved sessions, that's fine
		}
		return fmt.Errorf("read sessions file: %w", err)
	}

	var sessions []*model.Session
	if err := json.Unmarshal(data, &sessions); err != nil {
		return fmt.Errorf("unmarshal sessions: %w", err)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	for _, sess := range sessions {
		if sess != nil && sess.ID != "" {
			s.sessions[sess.ID] = sess
		}
	}

	return nil
}
