package session

import (
	"log/slog"
)

// recoverGoroutine logs any panic from a background goroutine without
// propagating it. Use as `defer recoverGoroutine(logger, "...")` at the top
// of background goroutines (autosave loop, threshold flush, etc).
func recoverGoroutine(logger *slog.Logger, name string) {
	if r := recover(); r != nil {
		logger.Error(name+" panic", slog.Any("panic", r))
	}
}
