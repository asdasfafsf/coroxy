//go:build darwin

package proxy

import (
	"fmt"
	"os/exec"
	"strconv"
	"strings"
)

// activeNetworkService returns the primary active network service name (e.g., "Wi-Fi").
func activeNetworkService() (string, error) {
	out, err := exec.Command("networksetup", "-listallnetworkservices").CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("list network services: %w", err)
	}

	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "*") || strings.Contains(line, "denotes") {
			continue
		}
		// Check if this service has an IP (meaning it's active).
		ipOut, _ := exec.Command("networksetup", "-getinfo", line).CombinedOutput()
		if strings.Contains(string(ipOut), "IP address") && !strings.Contains(string(ipOut), "IP address: none") {
			return line, nil
		}
	}

	return "Wi-Fi", nil // fallback
}

// EnableSystemProxy sets the macOS system HTTP and HTTPS proxy.
func EnableSystemProxy(httpAddr string) error {
	svc, err := activeNetworkService()
	if err != nil {
		return err
	}

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
		{"networksetup", "-setwebproxy", svc, host, port},
		{"networksetup", "-setwebproxystate", svc, "on"},
		{"networksetup", "-setsecurewebproxy", svc, host, port},
		{"networksetup", "-setsecurewebproxystate", svc, "on"},
	}

	for _, args := range cmds {
		if out, err := exec.Command(args[0], args[1:]...).CombinedOutput(); err != nil {
			return fmt.Errorf("%s: %s: %w", args[1], string(out), err)
		}
	}

	return nil
}

// DisableSystemProxy turns off the macOS system proxy.
func DisableSystemProxy() error {
	svc, err := activeNetworkService()
	if err != nil {
		return err
	}

	cmds := [][]string{
		{"networksetup", "-setwebproxystate", svc, "off"},
		{"networksetup", "-setsecurewebproxystate", svc, "off"},
	}

	for _, args := range cmds {
		if out, err := exec.Command(args[0], args[1:]...).CombinedOutput(); err != nil {
			return fmt.Errorf("%s: %s: %w", args[1], string(out), err)
		}
	}

	return nil
}
