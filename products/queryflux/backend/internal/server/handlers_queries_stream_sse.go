package server

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/application/services/query"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
	"github.com/sirupsen/logrus"
)

// streamQuery handles POST /api/v1/connections/:id/query/stream as
// Server-Sent Events (SSE) backed by the SafeQueryRunner.
//
// Frame format (per QUERY_CONTRACT.md):
//
//	event: chunk
//	data: {"columns":["c1","c2"],"rows":[[...],[...]],"index":0,"final":false}
//
//	event: done
//	data: {"total":1234}
//
//	event: error
//	data: {"error":"queryflux: query timeout"}
//
// Client disconnects (ctx.Done) abort the runner via the derived context.
func (s *Server) streamQuery(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		s.respondWithUnauthorized(c, "User not authenticated")
		return
	}
	connectionID := c.Param("id")
	if connectionID == "" {
		s.respondWithValidationError(c, "id", "Connection ID is required")
		return
	}

	var req ExecuteQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		s.respondWithValidationError(c, "request", "Invalid request format")
		return
	}
	if req.Timeout <= 0 {
		req.Timeout = 30
	}

	connectionService := s.container.GetConnectionService()
	connection, err := connectionService.GetByID(c.Request.Context(), connectionID)
	if err != nil {
		s.respondWithNotFound(c, "Connection")
		return
	}
	if connection.UserID != userID {
		s.respondWithForbidden(c, "Access denied to this connection")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Duration(req.Timeout)*time.Second)
	defer cancel()

	adapter, err := s.resolveAdapter(ctx, connection)
	if err != nil {
		s.respondWithAdapterError(c, connection, "streamQuery: resolveAdapter", err)
		return
	}
	defer func() { _ = adapter.Disconnect(ctx) }()

	w := c.Writer
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(200)
	flusher, ok := w.(interface{ Flush() })
	if !ok {
		// Server doesn't support flushing; bail with a clean error event.
		writeSSEError(w, "internal error")
		return
	}
	flusher.Flush()

	shim := newStreamAdapterShim(adapter, types.StreamOptions{
		MaxRows:   10000,
		BatchSize: 1000,
	})
	chunks, errCh := s.ensureRunner().Stream(ctx, shim, req.SQL, nil, query.QueryOptions{
		UserID:       userID,
		ConnectionID: connectionID,
		MaxRows:      10000,
		BatchSize:    1000,
		Timeout:      time.Duration(req.Timeout) * time.Second,
	})

	total := streamPump(ctx, w, flusher, chunks)
	finalErr := <-errCh
	if finalErr != nil {
		logrus.WithError(finalErr).Warn("stream finished with error")
		writeSSEError(w, SafeErrorMessage(finalErr))
		flusher.Flush()
		return
	}
	writeSSEDone(w, total)
	flusher.Flush()
}

// streamPump forwards runner chunks to the SSE writer until the chunk
// channel closes or ctx is cancelled. Returns total rows shipped.
func streamPump(
	ctx context.Context,
	w gin.ResponseWriter,
	flusher interface{ Flush() },
	chunks <-chan query.Chunk,
) int64 {
	var total int64
	for {
		select {
		case <-ctx.Done():
			return total
		case c, ok := <-chunks:
			if !ok {
				return total
			}
			total += int64(len(c.Rows))
			writeSSEChunk(w, c)
			flusher.Flush()
		}
	}
}

// writeSSEChunk emits one chunk frame.
func writeSSEChunk(w gin.ResponseWriter, c query.Chunk) {
	payload, _ := json.Marshal(map[string]interface{}{
		"columns": c.Columns,
		"rows":    c.Rows,
		"index":   c.Index,
		"final":   c.Final,
	})
	_, _ = fmt.Fprintf(w, "event: chunk\ndata: %s\n\n", payload)
}

// writeSSEDone emits the terminal done frame.
func writeSSEDone(w gin.ResponseWriter, total int64) {
	payload, _ := json.Marshal(map[string]interface{}{"total": total})
	_, _ = fmt.Fprintf(w, "event: done\ndata: %s\n\n", payload)
}

// writeSSEError emits a sanitised error frame. Message must already be
// SafeErrorMessage-clean — never pass raw err.Error() to this helper.
func writeSSEError(w gin.ResponseWriter, safeMsg string) {
	payload, _ := json.Marshal(map[string]interface{}{"error": safeMsg})
	_, _ = fmt.Fprintf(w, "event: error\ndata: %s\n\n", payload)
}
