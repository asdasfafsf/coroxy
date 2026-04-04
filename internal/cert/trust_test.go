package cert

import (
	"testing"
)

func TestIsCAInstalledReturnsFalseForNewCA(t *testing.T) {
	dir := t.TempDir()

	m, err := NewManager(dir)
	if err != nil {
		t.Fatalf("NewManager: %v", err)
	}

	installed, err := m.IsCAInstalled()
	if err != nil {
		t.Fatalf("IsCAInstalled: %v", err)
	}

	// A freshly generated CA should NOT be in the system trust store.
	if installed {
		t.Fatal("IsCAInstalled: got true for fresh CA, want false")
	}
}

func TestCAInfoInstalledFieldReflectsState(t *testing.T) {
	dir := t.TempDir()

	m, err := NewManager(dir)
	if err != nil {
		t.Fatalf("NewManager: %v", err)
	}

	// CAInfo should report not installed for fresh CA.
	info := m.CAInfo()
	if info.Installed {
		t.Fatal("CAInfo.Installed: got true for fresh CA, want false")
	}
}
