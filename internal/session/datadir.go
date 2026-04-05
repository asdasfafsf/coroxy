package session

import (
	"os"
	"path/filepath"
	"runtime"
)

// DataDir returns the OS-specific data directory for Coroxy.
//
//	macOS:   ~/Library/Application Support/Coroxy
//	Windows: %APPDATA%\Coroxy
//	Linux:   ~/.local/share/coroxy
func DataDir() (string, error) {
	var base string

	switch runtime.GOOS {
	case "darwin":
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		base = filepath.Join(home, "Library", "Application Support", "Coroxy")

	case "windows":
		appData := os.Getenv("APPDATA")
		if appData == "" {
			home, err := os.UserHomeDir()
			if err != nil {
				return "", err
			}
			appData = filepath.Join(home, "AppData", "Roaming")
		}
		base = filepath.Join(appData, "Coroxy")

	default: // linux and others
		xdg := os.Getenv("XDG_DATA_HOME")
		if xdg == "" {
			home, err := os.UserHomeDir()
			if err != nil {
				return "", err
			}
			xdg = filepath.Join(home, ".local", "share")
		}
		base = filepath.Join(xdg, "coroxy")
	}

	return base, nil
}

// SessionsDir returns the path to the sessions storage directory.
func SessionsDir() (string, error) {
	base, err := DataDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(base, "sessions"), nil
}
