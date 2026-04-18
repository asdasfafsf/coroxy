package app

import (
	"coroxy/internal/model"
)

// InstallCA installs the Root CA into the OS trust store.
func (a *App) InstallCA() error {
	return a.caManager.InstallCA()
}

// UninstallCA removes the Root CA from the OS trust store.
func (a *App) UninstallCA() error {
	return a.caManager.UninstallCA()
}

// CAInfo returns metadata about the Root CA.
func (a *App) CAInfo() model.CAInfo {
	return a.caManager.CAInfo()
}

// ExportCA exports the Root CA certificate to the given path.
func (a *App) ExportCA(path string) error {
	return a.caManager.ExportCA(path)
}
