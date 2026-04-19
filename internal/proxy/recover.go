package proxy

import (
	"log/slog"
)

// recoverGoroutine logs any panic from a relay goroutine without propagating it.
// Use as `defer recoverGoroutine(logger, "...")` at the top of request-level
// goroutines to keep the proxy alive when a single relay panics.
func recoverGoroutine(logger *slog.Logger, name string) {
	if r := recover(); r != nil {
		logger.Error(name+" panic", slog.Any("panic", r))
	}
}
