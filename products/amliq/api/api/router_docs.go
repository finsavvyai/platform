package api

import "net/http"

func setupDocsRoutes(mux *http.ServeMux) {
	docs := NewDocsHandler("docs/openapi.yaml")
	mux.HandleFunc("GET /docs", docs.ServeSwaggerUI)
	mux.HandleFunc("GET /docs/openapi.yaml", docs.ServeSpec)
	mux.HandleFunc("GET /openapi.json", docs.ServeSpecJSON)
}
