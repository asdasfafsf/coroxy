package main

import (
	"embed"
	"log"
	"log/slog"

	"coroxy/internal/app"
	"coroxy/internal/model"
	"coroxy/internal/proxy"
	"coroxy/internal/session"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	logger := slog.Default()
	store := session.NewMemoryStore()

	a := app.NewApp(nil, store) // engine set after creation for callback wiring

	engine := proxy.NewEngine(
		model.DefaultProxyConfig(),
		logger,
		a.HandleNewSession,
		nil, // CA manager (set after CA is initialized)
	)
	a.SetEngine(engine)

	err := wails.Run(&options.App{
		Title:  "Coroxy",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        a.Startup,
		Bind: []interface{}{
			a,
		},
	})

	if err != nil {
		log.Fatal(err)
	}
}
