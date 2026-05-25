package http

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/queryflux/backend/internal/application/ports"
	"go.uber.org/zap"
)

// MonitoringHandlers handles HTTP requests for monitoring endpoints
type MonitoringHandlers struct {
	logger           *zap.Logger
	metricsStorage   ports.MetricsStorage
	alertManager     ports.AlertManager
	dashboardManager ports.DashboardManager
	wsManager        ports.WebSocketManager
	upgrader         websocket.Upgrader
}

// NewMonitoringHandlers creates new monitoring handlers
func NewMonitoringHandlers(
	logger *zap.Logger,
	metricsStorage ports.MetricsStorage,
	alertManager ports.AlertManager,
	dashboardManager ports.DashboardManager,
	wsManager ports.WebSocketManager,
) *MonitoringHandlers {
	return &MonitoringHandlers{
		logger:           logger,
		metricsStorage:   metricsStorage,
		alertManager:     alertManager,
		dashboardManager: dashboardManager,
		wsManager:        wsManager,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
		},
	}
}

// RegisterRoutes registers monitoring routes
func (h *MonitoringHandlers) RegisterRoutes(router *gin.Engine) {
	monitoring := router.Group("/api/monitoring")
	{
		metrics := monitoring.Group("/metrics")
		{
			metrics.GET("", h.GetMetrics)
			metrics.GET("/series", h.GetMetricSeries)
			metrics.GET("/query", h.QueryMetrics)
			metrics.GET("/aggregate", h.AggregateMetrics)
			metrics.GET("/export/prometheus", h.ExportPrometheusMetrics)
		}

		alerts := monitoring.Group("/alerts")
		{
			alerts.GET("", h.GetAlerts)
			alerts.GET("/:id", h.GetAlert)
			alerts.POST("", h.CreateAlert)
			alerts.PUT("/:id", h.UpdateAlert)
			alerts.DELETE("/:id", h.DeleteAlert)
			alerts.POST("/:id/acknowledge", h.AcknowledgeAlert)
			alerts.POST("/:id/silence", h.SilenceAlert)
			alerts.POST("/:id/resolve", h.ResolveAlert)
			alerts.GET("/rules", h.GetAlertRules)
			alerts.POST("/rules", h.CreateAlertRule)
			alerts.PUT("/rules/:id", h.UpdateAlertRule)
			alerts.DELETE("/rules/:id", h.DeleteAlertRule)
		}

		dashboards := monitoring.Group("/dashboards")
		{
			dashboards.GET("", h.GetDashboards)
			dashboards.GET("/:id", h.GetDashboard)
			dashboards.POST("", h.CreateDashboard)
			dashboards.PUT("/:id", h.UpdateDashboard)
			dashboards.DELETE("/:id", h.DeleteDashboard)
			dashboards.POST("/:id/duplicate", h.DuplicateDashboard)
		}

		monitoring.GET("/health", h.GetHealthChecks)
		monitoring.GET("/ws", h.HandleWebSocket)
		monitoring.GET("/overview", h.GetSystemOverview)
	}

	router.GET("/ws", h.HandleWebSocket)
}
