package main

import (
	"encoding/json"
	"net/http"
	"net/http/pprof"
	"runtime"
	"strings"

	"finsavvyai-desktop/services"
)

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Performance profiling endpoints (pprof)
	if strings.HasPrefix(r.URL.Path, "/debug/pprof") {
		switch r.URL.Path {
		case "/debug/pprof/cmdline":
			pprof.Cmdline(w, r)
		case "/debug/pprof/profile":
			pprof.Profile(w, r)
		case "/debug/pprof/symbol":
			pprof.Symbol(w, r)
		case "/debug/pprof/trace":
			pprof.Trace(w, r)
		default:
			pprof.Index(w, r)
		}
		return
	}

	switch r.URL.Path {
	case "/api/cluster/status":
		s.handleClusterStatus(w, r)
	case "/api/cluster/nodes":
		if r.Method == "GET" {
			s.handleClusterNodes(w, r)
		} else if r.Method == "POST" {
			s.handleAddNode(w, r)
		}
	case "/api/cluster/nodes/delete":
		if r.Method == "DELETE" {
			s.handleRemoveNode(w, r)
		}
	case "/api/cluster/start":
		s.handleStartCluster(w, r)
	case "/api/cluster/stop":
		s.handleStopCluster(w, r)
	case "/api/config":
		if r.Method == "GET" {
			s.handleGetConfig(w, r)
		} else if r.Method == "POST" {
			s.handleUpdateConfig(w, r)
		}
	case "/debug/runtime":
		s.handleRuntimeStats(w, r)
	case "/ws":
		s.handleWebSocket(w, r)
	default:
		http.NotFound(w, r)
	}
}

func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		s.logger.WithError(err).Error("Failed to upgrade WebSocket connection")
		return
	}

	client := &services.WSClient{
		Conn:   conn,
		Send:   make(chan []byte, 256),
		Hub:    s.wsHub,
		Logger: s.logger,
	}

	s.wsHub.Register(client)

	go client.WritePump()
	go client.ReadPump()

	s.logger.Info("New WebSocket client connected")
}

func (s *Server) handleRuntimeStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)

	stats := map[string]interface{}{
		"goroutines":    runtime.NumGoroutine(),
		"go_version":    runtime.Version(),
		"num_cpu":       runtime.NumCPU(),
		"num_cgo_calls": runtime.NumCgoCall(),
		"memory": map[string]interface{}{
			"alloc_bytes":       mem.Alloc,
			"total_alloc_bytes": mem.TotalAlloc,
			"sys_bytes":         mem.Sys,
			"heap_alloc_bytes":  mem.HeapAlloc,
			"heap_sys_bytes":    mem.HeapSys,
			"heap_idle_bytes":   mem.HeapIdle,
			"heap_inuse_bytes":  mem.HeapInuse,
			"heap_objects":      mem.HeapObjects,
			"stack_inuse_bytes": mem.StackInuse,
			"gc_cycles":         mem.NumGC,
			"gc_pause_total_ns": mem.PauseTotalNs,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}
