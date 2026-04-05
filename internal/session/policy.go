package session

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// StoragePolicy defines limits for session archive storage.
type StoragePolicy struct {
	MaxSessions   int           // max sessions per archive (default 5000)
	MaxBytes      int64         // max archive file size in bytes (default 500MB)
	MaxAge        time.Duration // max age of archive (default 7 days)
	MaxArchives   int           // max rotated archives to keep (default 10)
}

// DefaultStoragePolicy returns the default storage policy.
func DefaultStoragePolicy() StoragePolicy {
	return StoragePolicy{
		MaxSessions: 5000,
		MaxBytes:    500 << 20, // 500 MB
		MaxAge:      7 * 24 * time.Hour,
		MaxArchives: 10,
	}
}

// archiveFile holds info about a .csaz file on disk.
type archiveFile struct {
	Path    string
	ModTime time.Time
	Size    int64
}

// EnforceRotation rotates the current archive and removes old archives
// that exceed the policy limits.
// It renames currentPath to a timestamped name and removes excess archives.
func (p StoragePolicy) EnforceRotation(dir string, currentName string) error {
	currentPath := filepath.Join(dir, currentName)

	// Rotate current file if it exists.
	if info, err := os.Stat(currentPath); err == nil {
		rotatedName := p.rotatedName(currentName, info.ModTime())
		rotatedPath := filepath.Join(dir, rotatedName)
		if err := os.Rename(currentPath, rotatedPath); err != nil {
			return fmt.Errorf("rotate archive: %w", err)
		}
	}

	// List all archive files in the directory.
	archives, err := p.listArchives(dir, currentName)
	if err != nil {
		return fmt.Errorf("list archives: %w", err)
	}

	// Sort by modification time, newest first.
	sort.Slice(archives, func(i, j int) bool {
		return archives[i].ModTime.After(archives[j].ModTime)
	})

	// Remove archives exceeding count limit or age limit.
	now := time.Now()
	for i, af := range archives {
		shouldRemove := i >= p.MaxArchives || now.Sub(af.ModTime) > p.MaxAge
		if shouldRemove {
			if err := os.Remove(af.Path); err != nil && !os.IsNotExist(err) {
				return fmt.Errorf("remove old archive %s: %w", af.Path, err)
			}
		}
	}

	return nil
}

// NeedsRotation checks if the current archive needs rotation based on size or session count.
func (p StoragePolicy) NeedsRotation(fileSize int64, sessionCount int) bool {
	return fileSize > p.MaxBytes || sessionCount > p.MaxSessions
}

func (p StoragePolicy) rotatedName(currentName string, t time.Time) string {
	ext := filepath.Ext(currentName)
	base := strings.TrimSuffix(currentName, ext)
	stamp := t.Format("20060102-150405")
	return fmt.Sprintf("%s-%s%s", base, stamp, ext)
}

func (p StoragePolicy) listArchives(dir string, currentName string) ([]archiveFile, error) {
	ext := filepath.Ext(currentName)
	base := strings.TrimSuffix(currentName, ext)

	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var archives []archiveFile
	for _, e := range entries {
		name := e.Name()
		if name == currentName {
			continue // skip the current (non-rotated) file
		}
		if !strings.HasPrefix(name, base) || !strings.HasSuffix(name, ext) {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		archives = append(archives, archiveFile{
			Path:    filepath.Join(dir, name),
			ModTime: info.ModTime(),
			Size:    info.Size(),
		})
	}

	return archives, nil
}
