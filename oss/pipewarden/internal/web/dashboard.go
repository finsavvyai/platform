package web

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed static/*
var staticFiles embed.FS

// DashboardHandler serves the embedded web dashboard from /static/ prefix.
func DashboardHandler() http.Handler {
	subFS, _ := fs.Sub(staticFiles, "static")
	return http.FileServer(http.FS(subFS))
}

// SPAHandler serves index.html for any non-existent routes (SPA catch-all).
func SPAHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "public, max-age=3600")
		http.ServeFileFS(w, r, staticFiles, "static/index.html")
	}
}

// EmbedHandler serves the embeddable findings widget.
func EmbedHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Cache-Control", "public, max-age=3600")
		http.ServeFileFS(w, r, staticFiles, "static/embed.html")
	}
}
