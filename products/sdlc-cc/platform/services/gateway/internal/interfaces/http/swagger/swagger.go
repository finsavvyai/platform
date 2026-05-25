// Package swagger serves API documentation powered by Scalar.
//
// Despite the package name (kept for backwards compatibility with existing
// imports and tests), this package now renders API docs using Scalar
// (https://github.com/scalar/scalar) instead of Swagger UI. Scalar reads the
// same OpenAPI spec served at /openapi.yaml and provides a modern dark-themed
// reference that matches the SDLC HeyGen design system.
package swagger

import (
	"embed"
	"io/fs"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

//go:embed ui/dist/*
var swaggerFS embed.FS

// SetupRoutes configures Scalar-powered API documentation routes.
func SetupRoutes(r chi.Router) {
	// Serve the main OpenAPI specification (consumed by Scalar).
	r.Get("/openapi.yaml", func(w http.ResponseWriter, r *http.Request) {
		spec, err := fs.ReadFile(swaggerFS, "ui/dist/openapi.yaml")
		if err != nil {
			spec, err = fs.ReadFile(swaggerFS, "openapi.yaml")
			if err != nil {
				http.Error(w, "OpenAPI specification not found", http.StatusNotFound)
				return
			}
		}
		w.Header().Set("Content-Type", "application/x-yaml")
		_, _ = w.Write(spec)
	})

	// Render the Scalar reference at /docs (no redirect indirection needed,
	// but kept as a redirect for backwards compatibility with bookmarks).
	r.Get("/docs", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/docs/index.html", http.StatusTemporaryRedirect)
	})

	// Serve embedded static docs assets (fallback OpenAPI YAML, etc).
	r.Handle("/docs/*", http.StripPrefix("/docs/", http.FileServer(getSwaggerUIFS())))

	// JSON metadata endpoint consumed by clients that need discoverability.
	r.Get("/docs.json", func(w http.ResponseWriter, r *http.Request) {
		render.JSON(w, r, map[string]interface{}{
			"title":              "SDLC.ai API Documentation",
			"description":        "Comprehensive API documentation for the SDLC.ai Secure Data Learning Platform",
			"version":            "v1",
			"swagger_url":        "/docs/index.html",
			"openapi_spec":       "/openapi.yaml",
			"postman_collection": "/docs/collection.json",
			"renderer":           "scalar",
			"sdk_docs": map[string]string{
				"python":     "https://docs.sdlc.cc/sdk/python",
				"typescript": "https://docs.sdlc.cc/sdk/typescript",
				"go":         "https://docs.sdlc.cc/sdk/go",
			},
		})
	})
}

// getSwaggerUIFS returns the embedded docs asset filesystem.
func getSwaggerUIFS() http.FileSystem {
	uiFS, err := fs.Sub(swaggerFS, "ui/dist")
	if err == nil {
		return http.FS(uiFS)
	}
	return http.FS(swaggerFS)
}
