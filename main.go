package main

import (
	"embed"
	"log"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"

	"coroxy/internal/app"
	"coroxy/internal/cert"
	"coroxy/internal/intercept"
	"coroxy/internal/model"
	"coroxy/internal/proxy"
	"coroxy/internal/rule"
	"coroxy/internal/session"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	logger := slog.Default()

	// CA Manager: ~/.coroxy/
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Fatal(err)
	}
	dataDir := filepath.Join(homeDir, ".coroxy")

	caManager, err := cert.NewManager(dataDir)
	if err != nil {
		log.Fatal(err)
	}

	store := session.NewMemoryStore()
	ruleEngine := rule.NewEngine()

	a := app.NewApp(nil, store, caManager, ruleEngine, logger)

	// Auto-save: .csaz archive with dual trigger (50 sessions / 30s).
	archivePath, err := store.ArchivePath()
	if err != nil {
		log.Fatal(err)
	}
	autoSaver, err := session.NewAutoSaver(
		store,
		session.DefaultStoragePolicy(),
		logger,
		func() string { return archivePath },
	)
	if err != nil {
		log.Fatal(err)
	}
	a.SetAutoSaver(autoSaver)
	autoSaver.Start()

	pipeline := intercept.NewPipeline()
	pipeline.Add(ruleEngine)

	modifier := intercept.NewModifier(ruleEngine.Rules)
	pipeline.Add(modifier)

	ar := intercept.NewAutoResponder(ruleEngine.Rules)
	pipeline.Add(ar)

	bp := intercept.NewBreakpoint(
		ruleEngine.Rules,
		func(pending *intercept.PendingRequest) {
			// Emit event to GUI when a breakpoint is hit.
			if a != nil && a.Context() != nil {
				wailsRuntime.EventsEmit(a.Context(), "coroxy:breakpoint:hit", map[string]string{
					"id":     pending.ID,
					"method": pending.Request.Method,
					"url":    pending.Request.URL.String(),
					"host":   pending.Request.Host,
				})
			}
		},
	)
	pipeline.Add(bp)
	a.SetBreakpoint(bp)

	engine := proxy.NewEngine(
		model.DefaultProxyConfig(),
		logger,
		a.HandleNewSession,
		proxy.NewProductionMITM(caManager),
		pipeline,
	)
	engine.SetAutoResponder(ar)
	a.SetEngine(engine)

	err = wails.Run(&options.App{
		Title:     "Coroxy",
		Width:     1280,
		Height:    800,
		MinWidth:  800,
		MinHeight: 500,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		// Match CSS dark card color: oklch(0.155 0.010 270) ≈ RGB(23, 23, 28)
		BackgroundColour: &options.RGBA{R: 23, G: 23, B: 28, A: 255},
		OnStartup:        a.Startup,
		OnShutdown:       a.Shutdown,
		Bind: []interface{}{
			a,
		},
		Mac: &mac.Options{
			TitleBar:   mac.TitleBarHiddenInset(),
			Appearance: mac.NSAppearanceNameDarkAqua,
			About: &mac.AboutInfo{
				Title:   "Coroxy",
				Message: "Local Network Debugging Proxy",
			},
		},
	})

	if err != nil {
		log.Fatal(err)
	}
}
