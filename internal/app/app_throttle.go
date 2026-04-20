package app

import (
	"coroxy/internal/throttle"
)

// ThrottleConfig represents throttling settings exposed to the frontend.
type ThrottleConfig struct {
	Preset      string `json:"preset"`
	BytesPerSec int64  `json:"bytes_per_sec"`
	LatencyMs   int64  `json:"latency_ms"`
	Enabled     bool   `json:"enabled"`
}

// SetThrottle configures network throttling.
func (a *App) SetThrottle(preset string) {
	switch preset {
	case "3g":
		a.throttler.SetConfig(throttle.Preset3G)
	case "4g":
		a.throttler.SetConfig(throttle.Preset4G)
	case "wifi":
		a.throttler.SetConfig(throttle.PresetWiFi)
	default:
		a.throttler.SetConfig(throttle.Off)
	}
}

// ThrottleState returns the current throttling state.
func (a *App) ThrottleState() ThrottleConfig {
	cfg := a.throttler.Config()
	preset := "off"
	switch {
	case cfg.BytesPerSec == throttle.Preset3G.BytesPerSec:
		preset = "3g"
	case cfg.BytesPerSec == throttle.Preset4G.BytesPerSec:
		preset = "4g"
	case cfg.BytesPerSec == throttle.PresetWiFi.BytesPerSec:
		preset = "wifi"
	}
	return ThrottleConfig{
		Preset:      preset,
		BytesPerSec: cfg.BytesPerSec,
		LatencyMs:   cfg.Latency.Milliseconds(),
		Enabled:     cfg.BytesPerSec > 0,
	}
}

// Throttler returns the throttler instance for proxy engine integration.
func (a *App) Throttler() *throttle.Throttler {
	return a.throttler
}
