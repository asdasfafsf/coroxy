package proxy

import (
	"fmt"
	"runtime"
)

// SetSystemProxy enables or disables the OS system proxy.
func SetSystemProxy(enable bool, httpAddr string) error {
	if enable {
		return enableSystemProxy(httpAddr)
	}
	return disableSystemProxy()
}

func enableSystemProxy(httpAddr string) error {
	switch runtime.GOOS {
	case "darwin":
		return EnableSystemProxy(httpAddr)
	default:
		return fmt.Errorf("system proxy not supported on %s", runtime.GOOS)
	}
}

func disableSystemProxy() error {
	switch runtime.GOOS {
	case "darwin":
		return DisableSystemProxy()
	default:
		return fmt.Errorf("system proxy not supported on %s", runtime.GOOS)
	}
}
