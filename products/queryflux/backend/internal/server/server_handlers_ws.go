package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// AI handlers (delegates to aiHandler)

func (s *Server) convertNLToSQL(c *gin.Context)         { s.aiHandler.ConvertNLToSQL(c) }
func (s *Server) optimizeQuery(c *gin.Context)          { s.aiHandler.OptimizeQuery(c) }
func (s *Server) explainQueryAI(c *gin.Context)         { s.aiHandler.ExplainQuery(c) }
func (s *Server) generateQuery(c *gin.Context)          { s.aiHandler.GenerateQuery(c) }
func (s *Server) analyzePerformance(c *gin.Context)     { s.aiHandler.AnalyzePerformance(c) }
func (s *Server) batchProcessAIRequests(c *gin.Context) { s.aiHandler.BatchProcessAIRequests(c) }
func (s *Server) getAIStatus(c *gin.Context)            { s.aiHandler.GetAIStatus(c) }

// WebSocket handlers

func (s *Server) handleWebSocketConnection(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userIDStr, ok := userID.(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		logrus.WithError(err).Error("Failed to upgrade WebSocket connection")
		return
	}

	client := NewClient(s.wsHub, conn, userIDStr)
	s.wsHub.register <- client

	go client.writePump()
	go client.readPump()
}

func (s *Server) getWebSocketStats(c *gin.Context) {
	stats := s.wsHub.GetStats()
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   stats,
	})
}

// GetWebSocketHub returns the WebSocket hub for use by other services
func (s *Server) GetWebSocketHub() *Hub {
	return s.wsHub
}
