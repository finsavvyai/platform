package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

type SecureQuery struct {
	Tenant      string   `json:"tenant"`
	Actor       string   `json:"actor"`
	Purpose     string   `json:"purpose"`
	Query       string   `json:"query"`
	Modes       []string `json:"modes"`
	Fields      []string `json:"fields"`
	PolicyCheck bool     `json:"policy_check"`
	Sensitivity string   `json:"sensitivity"`
}

type SecureResponse struct {
	CorrelationID string                 `json:"correlation_id"`
	Status        string                 `json:"status"`
	Answer        string                 `json:"answer"`
	Citations     []map[string]any       `json:"citations"`
	Risk          map[string]any         `json:"risk"`
	Cost          map[string]any         `json:"cost"`
	Meta          map[string]any         `json:"meta,omitempty"`
}

func health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(200)
	w.Write([]byte(`{"status":"ok"}`))
}

func secureQuery(w http.ResponseWriter, r *http.Request) {
	var req SecureQuery
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// TODO: authN, OPA policy, DLP, audit, call RAG + LLM gateways
	resp := SecureResponse{
		CorrelationID: "c-demo-0001",
		Status:        "ok",
		Answer:        "Demo answer (wire up RAG + LLM)",
		Citations:     []map[string]any{{"namespace": "demo/namespace", "rows": 0}},
		Risk:          map[string]any{"pii_leak": false, "policy": "allow"},
		Cost:          map[string]any{"tokens": 0, "usd": 0.0},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func main() {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	r.Get("/healthz", health)
	r.Post("/v1/query/secure", secureQuery)

	srv := &http.Server{
		Addr:    ":8080",
		Handler: r,
	}

	go func() {
		log.Printf("gateway listening on %s", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	// graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
	log.Println("gateway stopped")
}
