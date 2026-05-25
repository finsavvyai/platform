package api

import "net/http"

func setupBatchRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	if deps.Batches == nil {
		return
	}
	bh := NewBatchHandler(deps.Batches, deps.BatchResults)
	bs := NewBatchStatusHandler(deps.Batches, deps.BatchResults)

	mux.Handle("POST /api/v1/batch",
		authChain(http.HandlerFunc(bh.BatchScreen)))
	mux.Handle("GET /api/v1/batch/{id}",
		authChain(http.HandlerFunc(bs.GetBatch)))
	mux.Handle("GET /api/v1/batch/{id}/results",
		authChain(http.HandlerFunc(bs.GetResults)))

	if deps.BatchStreamer != nil {
		sh := NewBatchStreamHandler(deps.BatchStreamer)
		mux.Handle("POST /api/v1/batch/stream",
			authChain(http.HandlerFunc(sh.StreamBatch)))
	}
}
