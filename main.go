package main

import (
	"embed"
	"log"
	"log/slog"
	"os"
	"path/filepath"

	"coroxy/internal/app"
	"coroxy/internal/cert"
	"coroxy/internal/intercept"
	"coroxy/internal/model"
	"coroxy/internal/proxy"
	"coroxy/internal/rule"
	"coroxy/internal/session"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
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

	a := app.NewApp(nil, store, caManager, ruleEngine)

	pipeline := intercept.NewPipeline()
	pipeline.Add(ruleEngine)

	bp := intercept.NewBreakpoint(
		ruleEngine.Rules,
		func(pending *intercept.PendingRequest) {
			// Emit event to GUI when a breakpoint is hit.
			if a != nil {
				wailsRuntime.EventsEmit(a.GetContext(), "coroxy:breakpoint:hit", map[string]string{
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
	a.SetEngine(engine)

	err = wails.Run(&options.App{
		Title:  "Coroxy",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        a.Startup,
		OnShutdown:       a.Shutdown,
		Bind: []interface{}{
			a,
		},
	})

	if err != nil {
		log.Fatal(err)
	}
}
