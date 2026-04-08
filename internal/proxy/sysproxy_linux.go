//go:build linux

package proxy

import (
	"fmt"
	"os/exec"
	"strconv"
	"strings"
)

// EnableSystemProxy sets the GNOME system proxy via gsettings.
func EnableSystemProxy(httpAddr string) error {
	parts := strings.SplitN(httpAddr, ":", 2)
	host := parts[0]
	port := "8673"
	if len(parts) == 2 {
		port = parts[1]
		if portNum, err := strconv.Atoi(port); err != nil || portNum < 1 || portNum > 65535 {
			return fmt.Errorf("invalid port: %s", port)
		}
	}
	if host == "" || host == "[::]" || host == "0.0.0.0" {
		host = "127.0.0.1"
	}

	cmds := [][]string{
		{"gsettings", "set", "org.gnome.system.proxy", "mode", "manual"},
		{"gsettings", "set", "org.gnome.system.proxy.http", "host", host},
		{"gsettings", "set", "org.gnome.system.proxy.http", "port", port},
		{"gsettings", "set", "org.gnome.system.proxy.https", "host", host},
		{"gsettings", "set", "org.gnome.system.proxy.https", "port", port},
	}

	for _, args := range cmds {
		if out, err := exec.Command(args[0], args[1:]...).CombinedOutput(); err != nil {
			return fmt.Errorf("gsettings: %s: %w", string(out), err)
		}
	}

	return nil
}

// DisableSystemProxy turns off the GNOME system proxy.
func DisableSystemProxy() error {
	if out, err := exec.Command("gsettings", "set", "org.gnome.system.proxy", "mode", "none").CombinedOutput(); err != nil {
		return fmt.Errorf("gsettings: %s: %w", string(out), err)
	}
	return nil
}
