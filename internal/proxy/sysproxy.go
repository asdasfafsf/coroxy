package proxy

// SetSystemProxy enables or disables the OS system proxy.
// Platform-specific implementations are in sysproxy_darwin.go, sysproxy_windows.go, sysproxy_linux.go.
func SetSystemProxy(enable bool, httpAddr string) error {
	if enable {
		return EnableSystemProxy(httpAddr)
	}
	return DisableSystemProxy()
}
