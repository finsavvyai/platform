package adapter

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/domain"
)

func (s *HTTPServer) executeQuery(c *gin.Context) {
	var req domain.QueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse(err.Error()))
		return
	}

	userID, _ := GetUserID(c)
	result, err := s.queryService.Execute(c.Request.Context(), req, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse(err.Error()))
		return
	}

	c.JSON(http.StatusOK, domain.SuccessResponse(result))
}

func (s *HTTPServer) getSchema(c *gin.Context) {
	var req domain.SchemaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse(err.Error()))
		return
	}

	userID, _ := GetUserID(c)
	schema, err := s.schemaService.GetSchema(c.Request.Context(), req, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse(err.Error()))
		return
	}

	c.JSON(http.StatusOK, domain.SuccessResponse(schema))
}

func (s *HTTPServer) queryMetrics(c *gin.Context) {
	snapshot := s.queryService.Metrics().Snapshot()
	c.JSON(http.StatusOK, domain.SuccessResponse(snapshot))
}
