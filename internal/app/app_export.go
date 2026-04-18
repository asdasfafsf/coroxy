package app

import (
	"fmt"
	"os"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"coroxy/internal/session"
)

// selectSaveFile shows the OS Save dialog and returns the selected path.
// Empty path means the user cancelled.
func (a *App) selectSaveFile(title, defaultName, displayName, pattern string) (string, error) {
	return runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           title,
		DefaultFilename: defaultName,
		Filters: []runtime.FileFilter{
			{DisplayName: displayName, Pattern: pattern},
		},
	})
}

// selectOpenFile shows the OS Open dialog and returns the selected path.
// Empty path means the user cancelled.
func (a *App) selectOpenFile(title, displayName, pattern string) (string, error) {
	return runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: title,
		Filters: []runtime.FileFilter{
			{DisplayName: displayName, Pattern: pattern},
		},
	})
}

// ExportSessionsHAR exports all sessions as HAR to a user-selected file.
func (a *App) ExportSessionsHAR() error {
	path, err := a.selectSaveFile("Export HAR", "coroxy.har", "HAR Files", "*.har")
	if err != nil || path == "" {
		return err
	}

	sessions := a.store.List()
	data, err := session.ExportHAR(sessions)
	if err != nil {
		return fmt.Errorf("export HAR: %w", err)
	}
	return os.WriteFile(path, data, 0644)
}

// ExportSessionsJSON exports all sessions as JSON to a user-selected file.
func (a *App) ExportSessionsJSON() error {
	path, err := a.selectSaveFile("Export JSON", "coroxy-sessions.json", "JSON Files", "*.json")
	if err != nil || path == "" {
		return err
	}

	sessions := a.store.List()
	data, err := session.ExportJSON(sessions)
	if err != nil {
		return fmt.Errorf("export JSON: %w", err)
	}
	return os.WriteFile(path, data, 0644)
}

// ExportSessionsSAZ exports all HTTP sessions as SAZ to a user-selected file.
func (a *App) ExportSessionsSAZ() error {
	path, err := a.selectSaveFile("Export SAZ", "coroxy.saz", "SAZ Files", "*.saz")
	if err != nil || path == "" {
		return err
	}

	sessions := a.store.List()
	return session.ExportSAZ(path, sessions)
}

// SaveSessions saves all sessions to a user-selected .csaz file.
func (a *App) SaveSessions() error {
	path, err := a.selectSaveFile("Save Sessions", "coroxy-sessions.csaz", "Coroxy Archive", "*.csaz")
	if err != nil || path == "" {
		return err
	}

	sessions := a.store.List()
	return session.WriteArchive(path, sessions)
}

// LoadSessions loads sessions from a user-selected .csaz file and adds them to the store.
func (a *App) LoadSessions() (int, error) {
	path, err := a.selectOpenFile("Load Sessions", "Coroxy Archive", "*.csaz")
	if err != nil || path == "" {
		return 0, err
	}

	sessions, err := session.ReadArchive(path)
	if err != nil {
		return 0, fmt.Errorf("read archive: %w", err)
	}

	for _, s := range sessions {
		a.store.Add(s)
		runtime.EventsEmit(a.ctx, "coroxy:session:new", s)
	}
	return len(sessions), nil
}

// ImportSessionsSAZ imports sessions from a user-selected SAZ file.
func (a *App) ImportSessionsSAZ() (int, error) {
	path, err := a.selectOpenFile("Import SAZ", "SAZ Files", "*.saz")
	if err != nil || path == "" {
		return 0, err
	}

	sessions, err := session.ImportSAZ(path)
	if err != nil {
		return 0, fmt.Errorf("import SAZ: %w", err)
	}

	for _, s := range sessions {
		a.store.Add(s)
	}

	if a.autoSaver != nil {
		a.autoSaver.MarkDirtyN(len(sessions))
	}

	return len(sessions), nil
}

// ImportSessionsHAR imports sessions from a user-selected HAR file.
func (a *App) ImportSessionsHAR() (int, error) {
	path, err := a.selectOpenFile("Import HAR", "HAR Files", "*.har")
	if err != nil || path == "" {
		return 0, err
	}

	sessions, err := session.ImportHAR(path)
	if err != nil {
		return 0, fmt.Errorf("import HAR: %w", err)
	}

	for _, s := range sessions {
		a.store.Add(s)
	}

	if a.autoSaver != nil {
		a.autoSaver.MarkDirtyN(len(sessions))
	}

	return len(sessions), nil
}
