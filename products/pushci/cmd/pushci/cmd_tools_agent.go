package main

import (
	"fmt"
	"net/http"
	"os"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/detect"
	"github.com/finsavvyai/pushci/internal/platform"
	"github.com/finsavvyai/pushci/internal/runner"
	"github.com/finsavvyai/pushci/internal/server"
)

func cmdAgent() error {
	root, _ := os.Getwd()
	projects := detect.Scan(root)
	srv := server.New(root, projects)
	srv.RegisterProvider("github", &platform.GitHub{})
	srv.RegisterProvider("bitbucket", &platform.Bitbucket{})
	srv.RegisterProvider("circleci", &platform.CircleCI{})
	srv.RegisterProvider("azure", &platform.Azure{})

	cli.Header("PushCI Agent")
	port := ":8484"
	bindAddr := "0.0.0.0" + port
	tsMode := parseTailscaleMode()
	if tsMode != runner.TailscaleOff {
		bindAddr = setupTailscale(tsMode, port, bindAddr)
	}

	cli.Info(fmt.Sprintf("Webhook server listening on %s", bindAddr))
	cli.Info("Press Ctrl+C to stop")
	return http.ListenAndServe(bindAddr, srv.Handler())
}

func parseTailscaleMode() runner.TailscaleMode {
	tsMode := runner.TailscaleOff
	for _, arg := range os.Args[2:] {
		switch arg {
		case "--tailscale=serve":
			tsMode = runner.TailscaleServe
		case "--tailscale=funnel":
			tsMode = runner.TailscaleFunnel
		case "--tailscale=off":
			tsMode = runner.TailscaleOff
		}
	}
	return tsMode
}
