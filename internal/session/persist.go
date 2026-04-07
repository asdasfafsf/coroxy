package session

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"coroxy/internal/model"
)

const (
	archiveFileName = "sessions.csaz"
	legacyFileName  = "sessions.json"
)

// Persist saves all sessions in the store to disk as a .csaz archive.
func (s *MemoryStore) Persist() error {
	dir, err := s.sessionsDirFn()
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

	archivePath := filepath.Join(dir, archiveFileName)
	return WriteArchive(archivePath, sessions)
}

// Load reads sessions from disk and populates the store.
// It tries .csaz first, then falls back to legacy sessions.json.
func (s *MemoryStore) Load() error {
	dir, err := s.sessionsDirFn()
	if err != nil {
		return fmt.Errorf("get sessions dir: %w", err)
	}

	// Try .csaz first.
	archivePath := filepath.Join(dir, archiveFileName)
	if _, err := os.Stat(archivePath); err == nil {
		return s.loadFromArchive(archivePath)
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("stat archive: %w", err)
	}

	// Fall back to legacy sessions.json.
	legacyPath := filepath.Join(dir, legacyFileName)
	return s.loadFromLegacyJSON(legacyPath)
}

// ArchivePath returns the path to the current .csaz archive file.
func (s *MemoryStore) ArchivePath() (string, error) {
	dir, err := s.sessionsDirFn()
	if err != nil {
		return "", fmt.Errorf("get sessions dir: %w", err)
	}
	return filepath.Join(dir, archiveFileName), nil
}

func (s *MemoryStore) loadFromArchive(path string) error {
	sessions, err := ReadArchive(path)
	if err != nil {
		return fmt.Errorf("read archive: %w", err)
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

// maxLegacyJSONSize is the maximum size for the legacy sessions.json file (512 MB).
const maxLegacyJSONSize = 512 << 20

func (s *MemoryStore) loadFromLegacyJSON(path string) error {
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // no saved sessions, that's fine
		}
		return fmt.Errorf("stat sessions file: %w", err)
	}
	if info.Size() > maxLegacyJSONSize {
		return fmt.Errorf("sessions file too large: %d bytes (max %d)", info.Size(), maxLegacyJSONSize)
	}

	data, err := os.ReadFile(path)
	if err != nil {
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
