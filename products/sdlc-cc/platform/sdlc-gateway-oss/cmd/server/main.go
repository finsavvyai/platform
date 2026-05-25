// Package main wires the OSS gateway: tier rate limiting, device fingerprint,
// SCIM 2.0 Users, and Redis-backed event publishing — behind a chi router.
//
// The enterprise build of the platform layers DLP, OPA policies, RAG, and
// audit-grade Postgres on top of these same modules. This binary stays
// self-contained so a community user can `docker run` it and have a working
// rate-limited multi-tenant gateway in under five minutes.
package main

import (
	"context"
	"errors"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/sirupsen/logrus"

	"github.com/finsavvyai/sdlc-gateway/internal/events"
	"github.com/finsavvyai/sdlc-gateway/internal/fingerprint"
	"github.com/finsavvyai/sdlc-gateway/internal/memstore"
	"github.com/finsavvyai/sdlc-gateway/internal/ratelimit"
	"github.com/finsavvyai/sdlc-gateway/internal/redisclient"
	"github.com/finsavvyai/sdlc-gateway/internal/scim"
)

func main() {
	log := logrus.New()
	log.SetFormatter(&logrus.JSONFormatter{})

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	rdb, err := redisclient.New(ctx, redisOptionsFromEnv())
	if err != nil {
		log.WithError(err).Fatal("redis init failed")
	}

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(fingerprint.Middleware(fingerprint.Options{
		ClientIP: func(req *http.Request) string {
			host, _, err := net.SplitHostPort(req.RemoteAddr)
			if err != nil {
				return req.RemoteAddr
			}
			return host
		},
	}))

	if rdb != nil {
		limiter := ratelimit.NewTierRateLimiter(rdb)
		r.Use(limiter.Middleware())
		log.Info("tier rate limiter enabled (redis backend)")

		pub := events.NewPublisher(rdb, "sdlc:events:").WithLogger(log)
		log.WithField("channel_prefix", pub.Channel("<tenant>")).Info("event publisher enabled")
	} else {
		log.Warn("redis disabled — rate limiting and events are no-ops")
	}

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	scimHandler := &scim.Handler{
		Store:    memstore.NewSCIMStore(),
		Tenant:   tenantFromHeader,
		BasePath: "/scim/v2",
	}
	mux := http.NewServeMux()
	scimHandler.Register(mux)
	r.Mount("/scim/v2/", mux)

	addr := envOr("LISTEN_ADDR", ":8080")
	srv := &http.Server{
		Addr:              addr,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		log.WithField("addr", addr).Info("sdlc-gateway listening")
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.WithError(err).Fatal("server failed")
		}
	}()

	<-ctx.Done()
	log.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.WithError(err).Error("graceful shutdown failed")
	}
}

func tenantFromHeader(r *http.Request) (string, error) {
	if t := r.Header.Get("X-Tenant-ID"); t != "" {
		return t, nil
	}
	return "", errors.New("missing X-Tenant-ID header")
}

func redisOptionsFromEnv() redisclient.Options {
	port, _ := strconv.Atoi(envOr("REDIS_PORT", "6379"))
	db, _ := strconv.Atoi(envOr("REDIS_DB", "0"))
	return redisclient.Options{
		Host:        os.Getenv("REDIS_HOST"),
		Port:        port,
		Password:    os.Getenv("REDIS_PASSWORD"),
		Database:    db,
		DialTimeout: 2 * time.Second,
		ReadTimeout: 1 * time.Second,
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
