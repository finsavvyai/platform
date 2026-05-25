package main

import (
	"context"
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/aegis-aml/aegis/internal/agent"
)

func main() {
	configPath := flag.String("config", "", "path to config file")
	dataDir := flag.String("data-dir", "./data", "data directory")
	apiURL := flag.String("api-url", "https://api.amliq.com", "AMLIQ API URL")
	token := flag.String("token", "", "API authentication token")
	listenAddr := flag.String("listen", ":8090", "local API listen address")
	flag.Parse()

	cfg := agent.AgentConfig{
		ListUpdateURL: *apiURL + "/api/v1/agent/lists/latest",
		SyncInterval:  24 * time.Hour,
		DataDir:       *dataDir,
		WorkerCount:   4,
		APIToken:      *token,
	}
	if *configPath != "" {
		loadConfigFile(*configPath, &cfg)
	}

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()

	ag := agent.NewAgent(cfg)
	if err := ag.Start(ctx); err != nil {
		log.Printf("warning: initial sync failed: %v", err)
	}

	scheduler := agent.NewScheduler()
	_ = scheduler.ScheduleFullScan("0 0 1 * *")
	_ = scheduler.ScheduleDeltaScan("0 6 * * *")

	mux := http.NewServeMux()
	registerLocalRoutes(mux, ag)

	srv := &http.Server{Addr: *listenAddr, Handler: mux}
	go func() {
		log.Printf("aegis-agent listening on %s", *listenAddr)
		if err := srv.ListenAndServe(); err != http.ErrServerClosed {
			log.Fatalf("server: %v", err)
		}
	}()

	go scheduler.Run(ctx, func() {
		log.Println("running full scan")
	}, func() {
		log.Println("running delta scan")
	})

	<-ctx.Done()
	log.Println("shutting down...")
	shutCtx, shutCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutCancel()
	_ = srv.Shutdown(shutCtx)
}

func registerLocalRoutes(mux *http.ServeMux, ag *agent.Agent) {
	mux.HandleFunc("POST /screen", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})
	mux.HandleFunc("POST /batch", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})
	mux.HandleFunc("POST /check-transaction", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})
}

func loadConfigFile(path string, cfg *agent.AgentConfig) {
	data, err := os.ReadFile(path)
	if err != nil {
		log.Printf("config file: %v (using defaults)", err)
		return
	}
	if err := json.Unmarshal(data, cfg); err != nil {
		log.Printf("parse config: %v (using defaults)", err)
	}
}
