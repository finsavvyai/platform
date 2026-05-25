package api

import "net/http"

func setupWidgetRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
) {
	ih := NewIFrameHandler(deps.Tenants, deps.Entities)
	whitelist := IFrameWhitelistMiddleware(deps.Tenants)

	mux.HandleFunc("GET /api/v1/widget/widget.js", ih.ServeWidget)
	mux.HandleFunc("GET /embed", ih.ServeEmbedPage)
	mux.Handle("POST /api/v1/widget/screen",
		whitelist(http.HandlerFunc(ih.Screen)))
	mux.Handle("OPTIONS /api/v1/widget/screen",
		whitelist(http.HandlerFunc(handleCORSPreflight)))
}

func handleCORSPreflight(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers",
		"Content-Type, X-API-Key")
	w.Header().Set("Access-Control-Max-Age", "86400")
	setCORSHeaders(w, r)
	w.WriteHeader(http.StatusNoContent)
}
