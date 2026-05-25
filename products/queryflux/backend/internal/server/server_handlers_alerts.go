package server

import (
	"net/http"
	"strconv"

	"github.com/queryflux/backend/internal/domain/entities"

	"github.com/gin-gonic/gin"
)

func (s *Server) getAlerts(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))
	status := c.DefaultQuery("status", "all")
	severity := c.Query("severity")
	alertType := c.Query("type")
	connectionID := c.Query("connection_id")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 50
	}

	offset := (page - 1) * pageSize

	alertService := s.container.GetAlertService()
	var alerts []*entities.Alert
	var err error

	if connectionID != "" {
		connectionService := s.container.GetConnectionService()
		connection, connErr := connectionService.GetByID(c.Request.Context(), connectionID)
		if connErr != nil || connection.UserID != userID {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "ACCESS_DENIED",
				"message": "Access denied to this connection",
			})
			return
		}
		alerts, err = alertService.GetAlertsByConnection(c.Request.Context(), connectionID, pageSize, offset)
	} else if severity != "" {
		alerts, err = alertService.GetAlertsBySeverity(c.Request.Context(), userID, severity, pageSize, offset)
	} else if alertType != "" {
		alerts, err = alertService.GetAlertsByType(c.Request.Context(), userID, alertType, pageSize, offset)
	} else if status == "active" {
		alerts, err = alertService.GetActiveAlerts(c.Request.Context(), userID)
	} else {
		alerts, err = alertService.GetByUserID(c.Request.Context(), userID, pageSize, offset)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "ALERTS_FETCH_FAILED",
			"message": "Failed to retrieve alerts",
			"details": err.Error(),
		})
		return
	}

	if status != "all" && status != "active" {
		filteredAlerts := make([]*entities.Alert, 0)
		for _, alert := range alerts {
			if (status == "resolved" && alert.IsResolved()) ||
				(status == "muted" && alert.IsMuted()) {
				filteredAlerts = append(filteredAlerts, alert)
			}
		}
		alerts = filteredAlerts
	}

	alertResponses := make([]AlertResponse, len(alerts))
	for i, alert := range alerts {
		alertResponses[i] = s.mapAlertToResponse(alert)
	}

	c.JSON(http.StatusOK, AlertListResponse{
		Alerts:   alertResponses,
		Total:    int64(len(alerts)),
		Page:     page,
		PageSize: pageSize,
		HasMore:  len(alerts) == pageSize,
		Filters: map[string]string{
			"status": status, "severity": severity,
			"type": alertType, "connection_id": connectionID,
		},
	})
}

func (s *Server) getAlert(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	alertID := c.Param("id")
	if alertID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "VALIDATION_ERROR", "message": "Alert ID is required",
		})
		return
	}

	alertService := s.container.GetAlertService()
	alert, err := alertService.GetByID(c.Request.Context(), alertID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "ALERT_NOT_FOUND", "message": "Alert not found",
		})
		return
	}

	if alert.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "ACCESS_DENIED", "message": "Access denied to this alert",
		})
		return
	}

	c.JSON(http.StatusOK, s.mapAlertToResponse(alert))
}
