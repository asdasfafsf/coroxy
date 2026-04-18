package app

import (
	"fmt"
	"os"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"coroxy/internal/session"
)

// ExportSessionsHAR exports all sessions as HAR to a user-selected file.
func (a *App) ExportSessionsHAR() error {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Export HAR",
		DefaultFilename: "coroxy.har",
		Filters: []runtime.FileFilter{
			{DisplayName: "HAR Files", Pattern: "*.har"},
		},
	})
	if err != nil {
		return err
	}
	if path == "" {
		return nil // user cancelled
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
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Export JSON",
		DefaultFilename: "coroxy-sessions.json",
		Filters: []runtime.FileFilter{
			{DisplayName: "JSON Files", Pattern: "*.json"},
		},
	})
	if err != nil {
		return err
	}
	if path == "" {
		return nil
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
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Export SAZ",
		DefaultFilename: "coroxy.saz",
		Filters: []runtime.FileFilter{
			{DisplayName: "SAZ Files", Pattern: "*.saz"},
		},
	})
	if err != nil {
		return err
	}
	if path == "" {
		return nil
	}

	sessions := a.store.List()
	return session.ExportSAZ(path, sessions)
}

// SaveSessions saves all sessions to a user-selected .csaz file.
func (a *App) SaveSessions() error {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save Sessions",
		DefaultFilename: "coroxy-sessions.csaz",
		Filters: []runtime.FileFilter{
			{DisplayName: "Coroxy Archive", Pattern: "*.csaz"},
		},
	})
	if err != nil {
		return err
	}
	if path == "" {
		return nil
	}

	sessions := a.store.List()
	return session.WriteArchive(path, sessions)
}

// LoadSessions loads sessions from a user-selected .csaz file and adds them to the store.
func (a *App) LoadSessions() (int, error) {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Load Sessions",
		Filters: []runtime.FileFilter{
			{DisplayName: "Coroxy Archive", Pattern: "*.csaz"},
		},
	})
	if err != nil {
		return 0, err
	}
	if path == "" {
		return 0, nil
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
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Import SAZ",
		Filters: []runtime.FileFilter{
			{DisplayName: "SAZ Files", Pattern: "*.saz"},
		},
	})
	if err != nil {
		return 0, err
	}
	if path == "" {
		return 0, nil
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
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Import HAR",
		Filters: []runtime.FileFilter{
			{DisplayName: "HAR Files", Pattern: "*.har"},
		},
	})
	if err != nil {
		return 0, err
	}
	if path == "" {
		return 0, nil
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
