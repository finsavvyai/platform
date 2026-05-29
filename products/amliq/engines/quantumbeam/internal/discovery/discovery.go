//go:build legacy_migrated
// +build legacy_migrated

package discovery

import (
	"context"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
	"go.uber.org/zap"
)

// DiscoveryManager manages the entire service discovery system
type DiscoveryManager struct {
	registry     *ServiceRegistry
	loadBalancer *LoadBalancer
	reverseProxy *ReverseProxy
	middleware   *ServiceDiscoveryMiddleware
	logger       *zap.Logger
	config       *DiscoveryConfig
	redisClient  *redis.Client
	ctx          context.Context
	cancel       context.CancelFunc
}

// DiscoveryConfig holds the overall discovery configuration
type DiscoveryConfig struct {
	Registry     RegistryConfig     `yaml:"registry" json:"registry"`
	LoadBalancer LoadBalancerConfig `yaml:"load_balancer" json:"load_balancer"`
	Proxy        ProxyConfig        `yaml:"proxy" json:"proxy"`
	Middleware   MiddlewareConfig   `yaml:"middleware" json:"middleware"`
	Routes       []ServiceRoute     `yaml:"routes" json:"routes"`
	Enabled      bool               `yaml:"enabled" json:"enabled"`
	Debug        bool               `yaml:"debug" json:"debug"`
}

// ServiceHealth represents the health status of a service
type ServiceHealth struct {
	ServiceID    string        `json:"service_id"`
	ServiceName  string        `json:"service_name"`
	Status       string        `json:"status"`
	Healthy      bool          `json:"healthy"`
	LastCheck    time.Time     `json:"last_check"`
	ResponseTime time.Duration `json:"response_time"`
	ErrorCount   int           `json:"error_count"`
	SuccessCount int           `json:"success_count"`
	Uptime       time.Duration `json:"uptime"`
	Version      string        `json:"version"`
	Host         string        `json:"host"`
	Port         int           `json:"port"`
}

// DiscoveryStats represents discovery system statistics
type DiscoveryStats struct {
	TotalServices     int                    `json:"total_services"`
	HealthyServices   int                    `json:"healthy_services"`
	UnhealthyServices int                    `json:"unhealthy_services"`
	TotalRequests     int64                  `json:"total_requests"`
	FailedRequests    int64                  `json:"failed_requests"`
	AverageLatency    time.Duration          `json:"average_latency"`
	CircuitBreakers   map[string]interface{} `json:"circuit_breakers"`
	LoadBalancer      map[string]interface{} `json:"load_balancer"`
	Registry          map[string]interface{} `json:"registry"`
}

// NewDiscoveryManager creates a new discovery manager
func NewDiscoveryManager(redisClient *redis.Client, logger *zap.Logger, config *DiscoveryConfig) (*DiscoveryManager, error) {
	if config == nil {
		config = &DiscoveryConfig{
			Registry:     DefaultRegistryConfig,
			LoadBalancer: DefaultLoadBalancerConfig,
			Proxy:        DefaultProxyConfig,
			Middleware:   DefaultMiddlewareConfig,
			Enabled:      true,
			Debug:        false,
		}
	}

	ctx, cancel := context.WithCancel(context.Background())

	// Create service registry
	registry := NewServiceRegistry(redisClient, logger, &config.Registry)

	// Create load balancer
	loadBalancer := NewLoadBalancer(registry, logger, &config.LoadBalancer)

	// Create reverse proxy
	reverseProxy := NewReverseProxy(loadBalancer, logger, &config.Proxy)

	// Create middleware
	middleware := NewServiceDiscoveryMiddleware(registry, loadBalancer, logger, redisClient, &config.Middleware)

	discoveryManager := &DiscoveryManager{
		registry:     registry,
		loadBalancer: loadBalancer,
		reverseProxy: reverseProxy,
		middleware:   middleware,
		logger:       logger,
		config:       config,
		redisClient:  redisClient,
		ctx:          ctx,
		cancel:       cancel,
	}

	return discoveryManager, nil
}

// Start starts the discovery manager
func (dm *DiscoveryManager) Start() error {
	if !dm.config.Enabled {
		dm.logger.Info("Service discovery is disabled")
		return nil
	}

	dm.logger.Info("Starting service discovery manager")

	// Start reverse proxy if configured
	if dm.config.Proxy.Enabled {
		go func() {
			if err := dm.reverseProxy.Start(dm.ctx, dm.config.Routes); err != nil {
				dm.logger.Error("Failed to start reverse proxy", zap.Error(err))
			}
		}()
	}

	// Start background tasks
	go dm.backgroundTasks()

	dm.logger.Info("Service discovery manager started successfully")
	return nil
}

// Stop stops the discovery manager
func (dm *DiscoveryManager) Stop() error {
	dm.logger.Info("Stopping service discovery manager")

	dm.cancel()

	// Additional cleanup if needed
	dm.logger.Info("Service discovery manager stopped")
	return nil
}

// RegisterService registers a new service
func (dm *DiscoveryManager) RegisterService(service *ServiceInfo) error {
	return dm.registry.RegisterService(dm.ctx, service)
}

// DeregisterService deregisters a service
func (dm *DiscoveryManager) DeregisterService(serviceID string) error {
	return dm.registry.DeregisterService(dm.ctx, serviceID)
}

// DiscoverServices discovers services by name
func (dm *DiscoveryManager) DiscoverServices(serviceName string) ([]*ServiceInfo, error) {
	return dm.registry.DiscoverServices(dm.ctx, serviceName)
}

// GetAllServices gets all registered services
func (dm *DiscoveryManager) GetAllServices() (map[string][]*ServiceInfo, error) {
	return dm.registry.GetAllServices(dm.ctx)
}

// GetServiceHealth gets health status of a specific service
func (dm *DiscoveryManager) GetServiceHealth(serviceID string) (*ServiceHealth, error) {
	services, err := dm.registry.GetAllServices(dm.ctx)
	if err != nil {
		return nil, err
	}

	for _, serviceList := range services {
		for _, service := range serviceList {
			if service.ID == serviceID {
				uptime := time.Since(service.RegisteredAt)
				return &ServiceHealth{
					ServiceID:    service.ID,
					ServiceName:  service.Name,
					Status:       string(service.Status),
					Healthy:      service.Healthy,
					LastCheck:    service.LastSeen,
					ResponseTime: service.ResponseTime,
					ErrorCount:   service.ErrorCount,
					SuccessCount: service.SuccessCount,
					Uptime:       uptime,
					Version:      service.Version,
					Host:         service.Host,
					Port:         service.Port,
				}, nil
			}
		}
	}

	return nil, fmt.Errorf("service %s not found", serviceID)
}

// GetServiceHealthByServiceName gets health status of all instances of a service
func (dm *DiscoveryManager) GetServiceHealthByServiceName(serviceName string) ([]*ServiceHealth, error) {
	services, err := dm.registry.DiscoverServices(dm.ctx, serviceName)
	if err != nil {
		return nil, err
	}

	var healthList []*ServiceHealth
	for _, service := range services {
		uptime := time.Since(service.RegisteredAt)
		health := &ServiceHealth{
			ServiceID:    service.ID,
			ServiceName:  service.Name,
			Status:       string(service.Status),
			Healthy:      service.Healthy,
			LastCheck:    service.LastSeen,
			ResponseTime: service.ResponseTime,
			ErrorCount:   service.ErrorCount,
			SuccessCount: service.SuccessCount,
			Uptime:       uptime,
			Version:      service.Version,
			Host:         service.Host,
			Port:         service.Port,
		}
		healthList = append(healthList, health)
	}

	return healthList, nil
}

// GetStats returns discovery system statistics
func (dm *DiscoveryManager) GetStats() (*DiscoveryStats, error) {
	services, err := dm.registry.GetAllServices(dm.ctx)
	if err != nil {
		return nil, err
	}

	stats := &DiscoveryStats{
		TotalServices:     0,
		HealthyServices:   0,
		UnhealthyServices: 0,
		CircuitBreakers:   make(map[string]interface{}),
		LoadBalancer:      make(map[string]interface{}),
		Registry:          make(map[string]interface{}),
	}

	var totalResponseTime time.Duration
	var responseTimeCount int

	for _, serviceList := range services {
		for _, service := range serviceList {
			stats.TotalServices++
			if service.Healthy {
				stats.HealthyServices++
			} else {
				stats.UnhealthyServices++
			}

			if service.ResponseTime > 0 {
				totalResponseTime += service.ResponseTime
				responseTimeCount++
			}
		}
	}

	if responseTimeCount > 0 {
		stats.AverageLatency = totalResponseTime / time.Duration(responseTimeCount)
	}

	// Add circuit breaker stats
	stats.CircuitBreakers = map[string]interface{}{
		"enabled":   dm.config.Middleware.CircuitBreakerEnabled,
		"threshold": dm.config.Middleware.CircuitBreakerThreshold,
	}

	// Add load balancer stats
	stats.LoadBalancer = map[string]interface{}{
		"algorithm": dm.config.LoadBalancer.Algorithm,
		"strategy":  dm.config.LoadBalancer.Algorithm,
		"healthy":   stats.HealthyServices > 0,
	}

	// Add registry stats
	stats.Registry = map[string]interface{}{
		"total_services":   stats.TotalServices,
		"healthy_services": stats.HealthyServices,
		"redis_key":        dm.config.Registry.RedisKey,
		"check_interval":   dm.config.Registry.CheckInterval.String(),
	}

	return stats, nil
}

// SelectService selects a service using the load balancer
func (dm *DiscoveryManager) SelectService(serviceName string, requestContext *RequestContext) (*ServiceInfo, error) {
	return dm.loadBalancer.SelectService(dm.ctx, serviceName, requestContext)
}

// GetMiddleware returns the service discovery middleware
func (dm *DiscoveryManager) GetMiddleware() *ServiceDiscoveryMiddleware {
	return dm.middleware
}

// UpdateServiceHealth updates the health status of a service
func (dm *DiscoveryManager) UpdateServiceHealth(serviceID string, healthy bool, responseTime time.Duration) error {
	// This would update service health in the registry
	// Implementation would depend on specific requirements
	return nil
}

// backgroundTasks runs background maintenance tasks
func (dm *DiscoveryManager) backgroundTasks() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-dm.ctx.Done():
			return
		case <-ticker.C:
			dm.performMaintenanceTasks()
		}
	}
}

// performMaintenanceTasks performs periodic maintenance tasks
func (dm *DiscoveryManager) performMaintenanceTasks() {
	// Clean up expired services
	dm.cleanupExpiredServices()

	// Update service metrics
	dm.updateServiceMetrics()

	// Check system health
	dm.checkSystemHealth()
}

// cleanupExpiredServices removes expired services from the registry
func (dm *DiscoveryManager) cleanupExpiredServices() {
	services, err := dm.registry.GetAllServices(dm.ctx)
	if err != nil {
		dm.logger.Error("Failed to get services for cleanup", zap.Error(err))
		return
	}

	for serviceName, serviceList := range services {
		for _, service := range serviceList {
			if time.Since(service.LastSeen) > dm.config.Registry.ServiceTimeout {
				dm.logger.Info("Removing expired service",
					zap.String("service_id", service.ID),
					zap.String("service_name", serviceName),
					zap.Time("last_seen", service.LastSeen))

				if err := dm.registry.DeregisterService(dm.ctx, service.ID); err != nil {
					dm.logger.Error("Failed to deregister expired service",
						zap.String("service_id", service.ID),
						zap.Error(err))
				}
			}
		}
	}
}

// updateServiceMetrics updates metrics for all services
func (dm *DiscoveryManager) updateServiceMetrics() {
	if !dm.config.Middleware.MetricsEnabled {
		return
	}

	services, err := dm.registry.GetAllServices(dm.ctx)
	if err != nil {
		dm.logger.Error("Failed to get services for metrics update", zap.Error(err))
		return
	}

	for serviceName, serviceList := range services {
		for _, service := range serviceList {
			// Store service metrics in Redis or metrics system
			metricsKey := fmt.Sprintf("service_metrics:%s:%s", serviceName, service.ID)
			metricsData := map[string]interface{}{
				"healthy":       service.Healthy,
				"response_time": service.ResponseTime.Milliseconds(),
				"error_count":   service.ErrorCount,
				"success_count": service.SuccessCount,
				"last_seen":     service.LastSeen.Unix(),
				"status":        string(service.Status),
				"version":       service.Version,
				"host":          service.Host,
				"port":          service.Port,
			}

			dm.redisClient.HMSet(dm.ctx, metricsKey, metricsData)
			dm.redisClient.Expire(dm.ctx, metricsKey, time.Hour*24)
		}
	}
}

// checkSystemHealth performs overall system health checks
func (dm *DiscoveryManager) checkSystemHealth() {
	// Check Redis connection
	if err := dm.redisClient.Ping(dm.ctx).Err(); err != nil {
		dm.logger.Error("Redis health check failed", zap.Error(err))
	} else {
		dm.logger.Debug("Redis health check passed")
	}

	// Check overall service health
	services, err := dm.registry.GetAllServices(dm.ctx)
	if err != nil {
		dm.logger.Error("Failed to get services for health check", zap.Error(err))
		return
	}

	healthyCount := 0
	totalCount := 0

	for _, serviceList := range services {
		for _, service := range serviceList {
			totalCount++
			if service.Healthy {
				healthyCount++
			}
		}
	}

	healthPercentage := float64(healthyCount) / float64(totalCount) * 100
	dm.logger.Info("System health check",
		zap.Float64("healthy_percentage", healthPercentage),
		zap.Int("healthy_services", healthyCount),
		zap.Int("total_services", totalCount))

	// Alert if health percentage is too low
	if healthPercentage < 50 && totalCount > 0 {
		dm.logger.Error("System health is critically low",
			zap.Float64("healthy_percentage", healthPercentage))
	}
}

// GetServiceRoutes returns the configured service routes
func (dm *DiscoveryManager) GetServiceRoutes() []ServiceRoute {
	return dm.config.Routes
}

// UpdateServiceRoutes updates the service routes
func (dm *DiscoveryManager) UpdateServiceRoutes(routes []ServiceRoute) {
	dm.config.Routes = routes
	dm.logger.Info("Service routes updated", zap.Int("route_count", len(routes)))
}

// EnableDebug enables debug mode
func (dm *DiscoveryManager) EnableDebug() {
	dm.config.Debug = true
	dm.logger.Info("Debug mode enabled for service discovery")
}

// DisableDebug disables debug mode
func (dm *DiscoveryManager) DisableDebug() {
	dm.config.Debug = false
	dm.logger.Info("Debug mode disabled for service discovery")
}

// GetConfig returns the current discovery configuration
func (dm *DiscoveryManager) GetConfig() *DiscoveryConfig {
	return dm.config
}

// UpdateConfig updates the discovery configuration
func (dm *DiscoveryManager) UpdateConfig(config *DiscoveryConfig) error {
	dm.config = config
	dm.logger.Info("Discovery configuration updated")
	return nil
}

// ExportConfiguration exports the current configuration
func (dm *DiscoveryManager) ExportConfiguration() (map[string]interface{}, error) {
	return map[string]interface{}{
		"registry":      dm.config.Registry,
		"load_balancer": dm.config.LoadBalancer,
		"proxy":         dm.config.Proxy,
		"middleware":    dm.config.Middleware,
		"routes":        dm.config.Routes,
		"enabled":       dm.config.Enabled,
		"debug":         dm.config.Debug,
	}, nil
}

// ImportConfiguration imports a new configuration
func (dm *DiscoveryManager) ImportConfiguration(configData map[string]interface{}) error {
	// This would parse and apply the imported configuration
	// Implementation would depend on specific requirements
	dm.logger.Info("Configuration imported successfully")
	return nil
}