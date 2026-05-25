package main

import (
	"log"
	"net/http"
	_ "net/http/pprof" // Registers /debug/pprof/* handlers

	"github.com/felixge/fgprof"
)

// startProfileServer starts the pprof + fgprof server on an internal port.
// Access: go tool pprof http://localhost:6060/debug/pprof/profile
// Wall-clock: go tool pprof http://localhost:6060/debug/fgprof
func startProfileServer(addr string) {
	if addr == "" {
		addr = ":6060"
	}
	mux := http.DefaultServeMux
	mux.Handle("/debug/fgprof", fgprof.Handler())

	go func() {
		log.Printf("pprof server on %s", addr)
		if err := http.ListenAndServe(addr, mux); err != nil {
			log.Printf("pprof server error: %v", err)
		}
	}()
}
