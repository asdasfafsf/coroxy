//go:build windows

package proxy

import (
	"fmt"
	"os/exec"
	"strconv"
	"strings"
)

// EnableSystemProxy sets the Windows system proxy via registry.
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

	proxyServer := host + ":" + port

	// Enable proxy and set server address via reg.exe.
	cmds := [][]string{
		{"reg", "add", `HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings`, "/v", "ProxyEnable", "/t", "REG_DWORD", "/d", "1", "/f"},
		{"reg", "add", `HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings`, "/v", "ProxyServer", "/t", "REG_SZ", "/d", proxyServer, "/f"},
	}

	for _, args := range cmds {
		if out, err := exec.Command(args[0], args[1:]...).CombinedOutput(); err != nil {
			return fmt.Errorf("set proxy registry: %s: %w", string(out), err)
		}
	}

	return nil
}

// DisableSystemProxy turns off the Windows system proxy.
func DisableSystemProxy() error {
	args := []string{"reg", "add", `HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings`, "/v", "ProxyEnable", "/t", "REG_DWORD", "/d", "0", "/f"}
	if out, err := exec.Command(args[0], args[1:]...).CombinedOutput(); err != nil {
		return fmt.Errorf("disable proxy registry: %s: %w", string(out), err)
	}
	return nil
}
