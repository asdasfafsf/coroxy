package app

import (
	"coroxy/internal/proxy"
)

// StartProxy starts the proxy engine.
func (a *App) StartProxy() error {
	return a.engine.Start(a.ctx)
}

// StopProxy stops the proxy engine.
func (a *App) StopProxy() error {
	return a.engine.Stop(a.ctx)
}

// ProxyState returns the current proxy engine state.
func (a *App) ProxyState() string {
	return string(a.engine.State())
}

// EnableSystemProxy sets the OS system proxy to Coroxy.
func (a *App) EnableSystemProxy() error {
	addr := a.engine.HTTPAddr()
	if err := proxy.SetSystemProxy(true, addr); err != nil {
		return err
	}
	a.sysProxyActive = true
	return nil
}

// DisableSystemProxy turns off the OS system proxy.
func (a *App) DisableSystemProxy() error {
	if err := proxy.SetSystemProxy(false, ""); err != nil {
		return err
	}
	a.sysProxyActive = false
	return nil
}

// IsSystemProxyActive returns whether the system proxy is currently set.
func (a *App) IsSystemProxyActive() bool {
	return a.sysProxyActive
}
