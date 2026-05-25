package handlers

import (
	"net/http"
	"os"
	"strconv"

	"github.com/finsavvyai/pipewarden/internal/tracing"
)

// LatestTrace serves the most recent runtime/trace file. Drag-drop into
// https://ui.perfetto.dev to inspect. Returns 404 if tracing never ran.
//
// Tracing is opt-in via PIPEWARDEN_TRACE=1; the file path can be customized
// with PIPEWARDEN_TRACE_PATH.
func (h *Handlers) LatestTrace(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	path := tracing.Path()
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			jsonError(w, "no trace file yet — set PIPEWARDEN_TRACE=1 and run a scan", http.StatusNotFound)
			return
		}
		jsonError(w, "stat trace file failed", http.StatusInternalServerError)
		return
	}

	f, err := os.Open(path)
	if err != nil {
		jsonError(w, "open trace file failed", http.StatusInternalServerError)
		return
	}
	defer func() { _ = f.Close() }()

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", `attachment; filename="pipewarden.trace"`)
	w.Header().Set("Content-Length", strconv.FormatInt(info.Size(), 10))
	w.Header().Set("X-Trace-Active", strconv.FormatBool(tracing.Active()))
	http.ServeContent(w, r, "pipewarden.trace", info.ModTime(), f)
}
