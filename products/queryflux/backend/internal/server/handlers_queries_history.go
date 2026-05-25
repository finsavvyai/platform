package server

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/services"
	"github.com/sirupsen/logrus"
)

// getSchema handles GET /api/v1/connections/:id/schema.
func (s *Server) getSchema(c *gin.Context) {
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

	connectionService := s.container.GetConnectionService()
	connection, err := connectionService.GetByID(c.Request.Context(), connectionID)
	if err != nil {
		logrus.WithError(err).Error("Failed to get connection")
		s.respondWithNotFound(c, "Connection")
		return
	}

	if connection.UserID != userID {
		s.respondWithForbidden(c, "Access denied to this connection")
		return
	}

	databaseService := s.container.GetDatabaseService()
	schema, err := databaseService.GetSchema(c.Request.Context(), connectionID)
	if err != nil {
		logrus.WithError(err).Error("Failed to get database schema")
		s.respondWithInternalError(c, "Failed to retrieve database schema", err)
		return
	}

	response := s.mapSchemaToResponse(schema)
	s.respondWithSuccess(c, response)
}

// getQueryHistory handles GET /api/v1/connections/:id/history.
func (s *Server) getQueryHistory(c *gin.Context) {
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

	page, pageSize := parseQueryHistoryPagination(c)
	search := c.Query("search")
	offset := (page - 1) * pageSize

	connectionService := s.container.GetConnectionService()
	connection, err := connectionService.GetByID(c.Request.Context(), connectionID)
	if err != nil {
		logrus.WithError(err).Error("Failed to get connection")
		s.respondWithNotFound(c, "Connection")
		return
	}

	if connection.UserID != userID {
		s.respondWithForbidden(c, "Access denied to this connection")
		return
	}

	queryService := s.container.GetQueryService()
	var queries []*entities.Query
	if search != "" {
		queries, err = queryService.Search(c.Request.Context(), userID, search, pageSize, offset)
	} else {
		queries, err = queryService.GetHistory(c.Request.Context(), connectionID, pageSize, offset)
	}

	if err != nil {
		logrus.WithError(err).Error("Failed to get query history")
		s.respondWithInternalError(c, "Failed to retrieve query history", err)
		return
	}

	queryResponses := make([]QueryResponse, len(queries))
	for i, query := range queries {
		queryResponses[i] = s.mapQueryToResponse(query)
	}

	response := QueryListResponse{
		Queries:  queryResponses,
		Total:    int64(len(queries)),
		Page:     page,
		PageSize: pageSize,
		HasMore:  len(queries) == pageSize,
	}

	s.respondWithSuccess(c, response)
}

// mapSchemaToResponse converts a DatabaseSchema to SchemaResponse.
func (s *Server) mapSchemaToResponse(schema *services.DatabaseSchema) SchemaResponse {
	tables := make([]TableInfo, len(schema.Tables))
	for i, table := range schema.Tables {
		columns := make([]ColumnInfo, len(table.Columns))
		for j, col := range table.Columns {
			columns[j] = ColumnInfo{
				Name:         col.Name,
				Type:         col.Type,
				Nullable:     col.Nullable,
				DefaultValue: col.DefaultValue,
				IsPrimaryKey: col.IsPrimaryKey,
				IsForeignKey: col.IsForeignKey,
			}
		}
		indexes := make([]IndexInfo, len(table.Indexes))
		for j, idx := range table.Indexes {
			indexes[j] = IndexInfo{
				Name:    idx.Name,
				Columns: idx.Columns,
				Unique:  idx.Unique,
			}
		}
		tables[i] = TableInfo{
			Name:    table.Name,
			Columns: columns,
			Indexes: indexes,
		}
	}
	return SchemaResponse{Tables: tables}
}

// parseQueryHistoryPagination clamps page/pageSize for query history.
func parseQueryHistoryPagination(c *gin.Context) (int, int) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 50
	}
	return page, pageSize
}
