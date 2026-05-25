package server

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/queryflux/backend/internal/application/services/query"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
	"github.com/sirupsen/logrus"
)

// handleWebSocketQueryExecution streams query results over the WebSocket
// using SafeQueryRunner.Stream. Replaces the legacy simulated progress.
//
// Frame format (server -> client):
//
//	{"type":"start"}                                  // first frame
//	{"type":"chunk","columns":[...],"rows":[...],"index":N,"final":false}
//	{"type":"complete","total":N}
//	{"type":"error","error":"safe message"}
//
// userID is extracted from the gin context the upgrade was issued on and
// threaded into QueryOptions.UserID for audit attribution.
func (s *Server) handleWebSocketQueryExecution(
	gctx *gin.Context,
	conn *websocket.Conn,
	message map[string]interface{},
) {
	connectionID, _ := message["connection_id"].(string)
	if connectionID == "" {
		_ = conn.WriteJSON(map[string]interface{}{"type": "error", "error": "Missing connection_id"})
		return
	}
	sql, _ := message["sql"].(string)
	if sql == "" {
		_ = conn.WriteJSON(map[string]interface{}{"type": "error", "error": "Missing sql"})
		return
	}

	userID := gctx.GetString("user_id")
	if userID == "" {
		_ = conn.WriteJSON(map[string]interface{}{"type": "error", "error": SafeErrorMessage(types.ErrAuthFail)})
		return
	}

	connectionService := s.container.GetConnectionService()
	connection, err := connectionService.GetByID(gctx.Request.Context(), connectionID)
	if err != nil {
		_ = conn.WriteJSON(map[string]interface{}{"type": "error", "error": "connection not found"})
		return
	}
	if connection.UserID != userID {
		_ = conn.WriteJSON(map[string]interface{}{"type": "error", "error": SafeErrorMessage(types.ErrPermission)})
		return
	}

	ctx, cancel := context.WithTimeout(gctx.Request.Context(), 30*time.Second)
	defer cancel()

	adapter, err := s.resolveAdapter(ctx, connection)
	if err != nil {
		logrus.WithError(err).Warn("ws: resolveAdapter failed")
		_ = conn.WriteJSON(map[string]interface{}{"type": "error", "error": SafeErrorMessage(err)})
		return
	}
	defer func() { _ = adapter.Disconnect(ctx) }()

	_ = conn.WriteJSON(map[string]interface{}{"type": "start"})

	shim := newStreamAdapterShim(adapter, types.StreamOptions{MaxRows: 10000, BatchSize: 1000})
	chunks, errCh := s.ensureRunner().Stream(ctx, shim, sql, nil, query.QueryOptions{
		UserID:       userID,
		ConnectionID: connectionID,
		MaxRows:      10000,
		BatchSize:    1000,
		Timeout:      30 * time.Second,
	})

	total := wsPump(ctx, conn, chunks)
	finalErr := <-errCh
	if finalErr != nil {
		_ = conn.WriteJSON(map[string]interface{}{"type": "error", "error": SafeErrorMessage(finalErr)})
		return
	}
	_ = conn.WriteJSON(map[string]interface{}{"type": "complete", "total": total})
}

// wsPump forwards runner chunks to the WebSocket. Returns total rows.
func wsPump(ctx context.Context, conn *websocket.Conn, chunks <-chan query.Chunk) int64 {
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
			_ = conn.WriteJSON(map[string]interface{}{
				"type":    "chunk",
				"columns": c.Columns,
				"rows":    c.Rows,
				"index":   c.Index,
				"final":   c.Final,
			})
		}
	}
}
