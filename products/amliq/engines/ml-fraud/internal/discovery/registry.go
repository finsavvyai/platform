package discovery

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"strings"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/rs/xid"
	"go.uber.org/zap"
)

// ServiceRegistry manages service registration and discovery
type ServiceRegistry struct {
	redisClient *redis.Client
	logger      *zap.Logger
	config      *RegistryConfig
	mu          sync.RWMutex
	services    map[string]*ServiceInfo
}

// RegistryConfig holds service registry configuration
type RegistryConfig struct {
	Enabled         bool          `yaml:"enabled" json:"enabled"`
	RedisKey        string        `yaml:"redis_key" json:"redis_key"`
	CheckInterval   time.Duration `yaml:"check_interval" json:"check_interval"`
	ServiceTimeout  time.Duration `yaml:"service_timeout" json:"service_timeout"`
	HealthCheckPath string        `yaml:"health_check_path" json:"health_check_path"`
	MaxRetries      int           `yaml:"max_retries" json:"max_retries"`
	RetryDelay      time.Duration `yaml:"retry_delay" json:"retry_delay"`
	EnableMetrics   bool          `yaml:"enable_metrics" json:"enable_metrics"`
}

// ServiceInfo represents a registered service
type ServiceInfo struct {
	ID              string            `json:"id" yaml:"id"`
	Name            string            `json:"name" yaml:"name"`
	Host            string            `json:"host" yaml:"host"`
	Port            int               `json:"port" yaml:"port"`
	Scheme          string            `json:"scheme" yaml:"scheme"`
	Path            string            `json:"path" yaml:"path"`
	Version         string            `json:"version" yaml:"version"`
	Weight          int               `json:"weight" yaml:"weight"`
	Protocol        string            `json:"protocol" yaml:"protocol"`
	Region          string            `json:"region" yaml:"region"`
	Zone            string            `json:"zone" yaml:"zone"`
	Tags            []string          `json:"tags" yaml:"tags"`
	Metadata        map[string]string `json:"metadata" yaml:"metadata"`
	HealthCheckURL  string            `json:"health_check_url" yaml:"health_check_url"`
	HealthCheckPath string            `json:"health_check_path" yaml:"health_check_path"`
	Timeout         time.Duration     `json:"timeout" yaml:"timeout"`
	Retries         int               `json:"retries" yaml:"retries"`
	RegisteredAt    time.Time         `json:"registered_at" yaml:"registered_at"`
	LastSeen        time.Time         `json:"last_seen" yaml:"last_seen"`
	Status          ServiceStatus     `json:"status" yaml:"status"`
	Healthy         bool              `json:"healthy" yaml:"healthy"`
	ResponseTime    time.Duration     `json:"response_time" yaml:"response_time"`
	ErrorCount      int               `json:"error_count" yaml:"error_count"`
	SuccessCount    int               `json:"success_count" yaml:"success_count"`
}

// ServiceStatus represents the status of a service
type ServiceStatus string

const (
	ServiceStatusStarting   ServiceStatus = "starting"
	ServiceStatusHealthy    ServiceStatus = "healthy"
	ServiceStatusUnhealthy  ServiceStatus = "unhealthy"
	ServiceStatusDraining   ServiceStatus = "draining"
	ServiceStatusTerminated ServiceStatus = "terminated"
)

// LoadBalancerConfig holds load balancer configuration
type LoadBalancerConfig struct {
	Algorithm           string        `yaml:"algorithm" json:"algorithm"` // round_robin, weighted_round_robin, least_connections, random, consistent_hash
	HealthCheckInterval time.Duration `yaml:"health_check_interval" json:"health_check_interval"`
	UnhealthyThreshold  int           `yaml:"unhealthy_threshold" json:"unhealthy_threshold"`
	HealthyThreshold    int           `yaml:"healthy_threshold" json:"healthy_threshold"`
	Timeout             time.Duration `yaml:"timeout" json:"timeout"`
	Retries             int           `yaml:"retries" json:"retries"`
	EnableStickySession bool          `yaml:"enable_sticky_session" json:"enable_sticky_session"`
	SessionAffinity     string        `yaml:"session_affinity" json:"session_affinity"` // cookie, ip_hash, header
}

// LoadBalancer manages load balancing across service instances
type LoadBalancer struct {
	registry    *ServiceRegistry
	logger      *zap.Logger
	config      *LoadBalancerConfig
	strategy    LoadBalancingStrategy
	mu          sync.RWMutex
	counters    map[string]int // request counters for round robin
	connections map[string]int // active connections for least connections
}

// LoadBalancingStrategy defines the load balancing strategy interface
type LoadBalancingStrategy interface {
	SelectService(services []*ServiceInfo, requestContext *RequestContext) *ServiceInfo
}

// RequestContext holds context for request routing
type RequestContext struct {
	RequestID string
	Method    string
	Path      string
	Headers   map[string]string
	IP        string
	UserAgent string
	SessionID string
	Key       string // for consistent hashing
}

// Default registry and load balancer configurations
var (
	DefaultRegistryConfig = RegistryConfig{
		Enabled:         true,
		RedisKey:        "quantumbeam:services",
		CheckInterval:   30 * time.Second,
		ServiceTimeout:  60 * time.Second,
		HealthCheckPath: "/health",
		MaxRetries:      3,
		RetryDelay:      2 * time.Second,
		EnableMetrics:   true,
	}

	DefaultLoadBalancerConfig = LoadBalancerConfig{
		Algorithm:           "weighted_round_robin",
		HealthCheckInterval: 15 * time.Second,
		UnhealthyThreshold:  3,
		HealthyThreshold:    2,
		Timeout:             5 * time.Second,
		Retries:             2,
		EnableStickySession: false,
		SessionAffinity:     "cookie",
	}
)

// NewServiceRegistry creates a new service registry
func NewServiceRegistry(redisClient *redis.Client, logger *zap.Logger, config *RegistryConfig) *ServiceRegistry {
	if config == nil {
		config = &DefaultRegistryConfig
	}

	registry := &ServiceRegistry{
		redisClient: redisClient,
		logger:      logger,
		config:      config,
		services:    make(map[string]*ServiceInfo),
	}

	// Start health checker
	go registry.healthChecker()

	return registry
}

// RegisterService registers a new service instance
func (sr *ServiceRegistry) RegisterService(ctx context.Context, service *ServiceInfo) error {
	if service.ID == "" {
		service.ID = xid.New().String()
	}

	if service.RegisteredAt.IsZero() {
		service.RegisteredAt = time.Now()
	}

	service.LastSeen = time.Now()
	service.Status = ServiceStatusStarting

	// Set default health check path if not provided
	if service.HealthCheckPath == "" {
		service.HealthCheckPath = sr.config.HealthCheckPath
	}

	// Build health check URL if not provided
	if service.HealthCheckURL == "" && service.HealthCheckPath != "" {
		scheme := service.Scheme
		if scheme == "" {
			scheme = "http"
		}
		service.HealthCheckURL = fmt.Sprintf("%s://%s:%d%s", scheme, service.Host, service.Port, service.HealthCheckPath)
	}

	// Store in local cache
	sr.mu.Lock()
	sr.services[service.ID] = service
	sr.mu.Unlock()

	// Store in Redis
	serviceKey := fmt.Sprintf("%s:%s", sr.config.RedisKey, service.ID)
	serviceData, err := json.Marshal(service)
	if err != nil {
		return fmt.Errorf("failed to marshal service data: %w", err)
	}

	pipe := sr.redisClient.Pipeline()
	pipe.Set(ctx, serviceKey, serviceData, sr.config.ServiceTimeout)
	pipe.SAdd(ctx, sr.config.RedisKey+":set", service.ID)

	if service.Name != "" {
		pipe.SAdd(ctx, fmt.Sprintf("%s:%s", sr.config.RedisKey, service.Name), service.ID)
	}

	_, err = pipe.Exec(ctx)
	if err != nil {
		return fmt.Errorf("failed to store service in Redis: %w", err)
	}

	sr.logger.Info("Service registered",
		zap.String("service_id", service.ID),
		zap.String("service_name", service.Name),
		zap.String("host", service.Host),
		zap.Int("port", service.Port),
		zap.String("version", service.Version))

	return nil
}

// DeregisterService removes a service from the registry
func (sr *ServiceRegistry) DeregisterService(ctx context.Context, serviceID string) error {
	// Get service info before removal
	sr.mu.RLock()
	service, exists := sr.services[serviceID]
	sr.mu.RUnlock()

	if !exists {
		// Try to get from Redis
		serviceKey := fmt.Sprintf("%s:%s", sr.config.RedisKey, serviceID)
		serviceData, err := sr.redisClient.Get(ctx, serviceKey).Result()
		if err == redis.Nil {
			return fmt.Errorf("service %s not found", serviceID)
		} else if err != nil {
			return fmt.Errorf("failed to get service from Redis: %w", err)
		}

		service = &ServiceInfo{}
		if err := json.Unmarshal([]byte(serviceData), service); err != nil {
			return fmt.Errorf("failed to unmarshal service data: %w", err)
		}
	}

	// Update status
	service.Status = ServiceStatusTerminated
	service.LastSeen = time.Now()

	// Remove from local cache
	sr.mu.Lock()
	delete(sr.services, serviceID)
	sr.mu.Unlock()

	// Remove from Redis
	pipe := sr.redisClient.Pipeline()
	serviceKey := fmt.Sprintf("%s:%s", sr.config.RedisKey, serviceID)
	pipe.Del(ctx, serviceKey)
	pipe.SRem(ctx, sr.config.RedisKey+":set", serviceID)

	if service.Name != "" {
		pipe.SRem(ctx, fmt.Sprintf("%s:%s", sr.config.RedisKey, service.Name), serviceID)
	}

	_, err := pipe.Exec(ctx)
	if err != nil {
		return fmt.Errorf("failed to remove service from Redis: %w", err)
	}

	sr.logger.Info("Service deregistered",
		zap.String("service_id", serviceID),
		zap.String("service_name", service.Name))

	return nil
}

// DiscoverServices finds all instances of a given service
func (sr *ServiceRegistry) DiscoverServices(ctx context.Context, serviceName string) ([]*ServiceInfo, error) {
	serviceIDs, err := sr.redisClient.SMembers(ctx, fmt.Sprintf("%s:%s", sr.config.RedisKey, serviceName)).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get service IDs from Redis: %w", err)
	}

	var services []*ServiceInfo
	for _, serviceID := range serviceIDs {
		serviceKey := fmt.Sprintf("%s:%s", sr.config.RedisKey, serviceID)
		serviceData, err := sr.redisClient.Get(ctx, serviceKey).Result()
		if err == redis.Nil {
			// Service expired, remove from set
			sr.redisClient.SRem(ctx, fmt.Sprintf("%s:%s", sr.config.RedisKey, serviceName), serviceID)
			continue
		} else if err != nil {
			sr.logger.Warn("Failed to get service from Redis",
				zap.String("service_id", serviceID),
				zap.Error(err))
			continue
		}

		service := &ServiceInfo{}
		if err := json.Unmarshal([]byte(serviceData), service); err != nil {
			sr.logger.Warn("Failed to unmarshal service data",
				zap.String("service_id", serviceID),
				zap.Error(err))
			continue
		}

		// Only return healthy services
		if service.Status == ServiceStatusHealthy && service.Healthy {
			services = append(services, service)
		}
	}

	return services, nil
}

// GetAllServices returns all registered services
func (sr *ServiceRegistry) GetAllServices(ctx context.Context) (map[string][]*ServiceInfo, error) {
	serviceNames, err := sr.redisClient.Keys(ctx, sr.config.RedisKey+":*").Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get service keys from Redis: %w", err)
	}

	result := make(map[string][]*ServiceInfo)
	for _, key := range serviceNames {
		if strings.HasSuffix(key, ":set") {
			continue
		}

		parts := strings.Split(key, ":")
		if len(parts) < 3 {
			continue
		}

		serviceName := parts[2]
		serviceData, err := sr.redisClient.Get(ctx, key).Result()
		if err != nil {
			continue
		}

		service := &ServiceInfo{}
		if err := json.Unmarshal([]byte(serviceData), service); err != nil {
			continue
		}

		result[serviceName] = append(result[serviceName], service)
	}

	return result, nil
}

// healthChecker periodically checks the health of registered services
func (sr *ServiceRegistry) healthChecker() {
	ticker := time.NewTicker(sr.config.CheckInterval)
	defer ticker.Stop()

	for range ticker.C {
		ctx := context.Background()
		sr.checkAllServicesHealth(ctx)
	}
}

// checkAllServicesHealth checks the health of all registered services
func (sr *ServiceRegistry) checkAllServicesHealth(ctx context.Context) {
	services, err := sr.GetAllServices(ctx)
	if err != nil {
		sr.logger.Error("Failed to get services for health check", zap.Error(err))
		return
	}

	for serviceName, serviceList := range services {
		for _, service := range serviceList {
			go sr.checkServiceHealth(ctx, serviceName, service)
		}
	}
}

// checkServiceHealth checks the health of a single service
func (sr *ServiceRegistry) checkServiceHealth(ctx context.Context, serviceName string, service *ServiceInfo) {
	start := time.Now()
	healthy := sr.performHealthCheck(ctx, service)
	responseTime := time.Since(start)

	// Update service health status
	service.LastSeen = time.Now()
	service.ResponseTime = responseTime

	if healthy {
		if service.Status == ServiceStatusStarting || service.Status == ServiceStatusUnhealthy {
			service.Status = ServiceStatusHealthy
		}
		service.Healthy = true
		service.SuccessCount++
		service.ErrorCount = 0 // Reset error count on success
	} else {
		service.ErrorCount++
		if service.ErrorCount >= 3 {
			service.Status = ServiceStatusUnhealthy
			service.Healthy = false
		}
	}

	// Update in Redis
	serviceKey := fmt.Sprintf("%s:%s", sr.config.RedisKey, service.ID)
	serviceData, err := json.Marshal(service)
	if err != nil {
		sr.logger.Error("Failed to marshal service data during health check",
			zap.String("service_id", service.ID),
			zap.Error(err))
		return
	}

	if err := sr.redisClient.Set(ctx, serviceKey, serviceData, sr.config.ServiceTimeout).Err(); err != nil {
		sr.logger.Error("Failed to update service health in Redis",
			zap.String("service_id", service.ID),
			zap.Error(err))
	}

	sr.logger.Debug("Service health check completed",
		zap.String("service_name", serviceName),
		zap.String("service_id", service.ID),
		zap.Bool("healthy", healthy),
		zap.Duration("response_time", responseTime))
}

// performHealthCheck performs the actual health check
func (sr *ServiceRegistry) performHealthCheck(ctx context.Context, service *ServiceInfo) bool {
	if service.HealthCheckURL == "" {
		return true // No health check configured, assume healthy
	}

	client := &http.Client{
		Timeout: service.Timeout,
	}

	req, err := http.NewRequestWithContext(ctx, "GET", service.HealthCheckURL, nil)
	if err != nil {
		return false
	}

	req.Header.Set("User-Agent", "QuantumBeam-HealthChecker/1.0")

	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode >= 200 && resp.StatusCode < 300
}

// NewLoadBalancer creates a new load balancer
func NewLoadBalancer(registry *ServiceRegistry, logger *zap.Logger, config *LoadBalancerConfig) *LoadBalancer {
	if config == nil {
		config = &DefaultLoadBalancerConfig
	}

	lb := &LoadBalancer{
		registry:    registry,
		logger:      logger,
		config:      config,
		counters:    make(map[string]int),
		connections: make(map[string]int),
	}

	// Set load balancing strategy
	switch strings.ToLower(config.Algorithm) {
	case "round_robin":
		lb.strategy = &RoundRobinStrategy{counters: lb.counters}
	case "weighted_round_robin":
		lb.strategy = &WeightedRoundRobinStrategy{counters: lb.counters}
	case "least_connections":
		lb.strategy = &LeastConnectionsStrategy{connections: lb.connections}
	case "random":
		lb.strategy = &RandomStrategy{}
	case "consistent_hash":
		lb.strategy = &ConsistentHashStrategy{}
	case "ip_hash":
		lb.strategy = &IPHashStrategy{}
	default:
		lb.strategy = &WeightedRoundRobinStrategy{counters: lb.counters}
	}

	// Start health checker
	go lb.healthChecker()

	return lb
}

// SelectService selects a service instance based on the load balancing strategy
func (lb *LoadBalancer) SelectService(ctx context.Context, serviceName string, requestContext *RequestContext) (*ServiceInfo, error) {
	services, err := lb.registry.DiscoverServices(ctx, serviceName)
	if err != nil {
		return nil, fmt.Errorf("failed to discover services: %w", err)
	}

	if len(services) == 0 {
		return nil, fmt.Errorf("no healthy services available for %s", serviceName)
	}

	// Filter services by status and health
	healthyServices := make([]*ServiceInfo, 0)
	for _, service := range services {
		if service.Status == ServiceStatusHealthy && service.Healthy {
			healthyServices = append(healthyServices, service)
		}
	}

	if len(healthyServices) == 0 {
		return nil, fmt.Errorf("no healthy services available for %s", serviceName)
	}

	// Apply sticky session if enabled
	if lb.config.EnableStickySession && requestContext.SessionID != "" {
		if stickyService := lb.getStickySessionService(serviceName, requestContext.SessionID); stickyService != nil {
			return stickyService, nil
		}
	}

	// Use load balancing strategy to select service
	selectedService := lb.strategy.SelectService(healthyServices, requestContext)

	// Store sticky session if enabled
	if lb.config.EnableStickySession && requestContext.SessionID != "" {
		lb.setStickySessionService(serviceName, requestContext.SessionID, selectedService.ID)
	}

	// Update connection count for least connections
	if _, ok := lb.strategy.(*LeastConnectionsStrategy); ok {
		lb.mu.Lock()
		lb.connections[selectedService.ID]++
		lb.mu.Unlock()
	}

	lb.logger.Debug("Service selected",
		zap.String("service_name", serviceName),
		zap.String("service_id", selectedService.ID),
		zap.String("algorithm", lb.config.Algorithm))

	return selectedService, nil
}

// healthChecker periodically checks service health for load balancer
func (lb *LoadBalancer) healthChecker() {
	ticker := time.NewTicker(lb.config.HealthCheckInterval)
	defer ticker.Stop()

	for range ticker.C {
		ctx := context.Background()
		lb.checkServicesHealth(ctx)
	}
}

// checkServicesHealth checks the health of services for load balancer
func (lb *LoadBalancer) checkServicesHealth(ctx context.Context) {
	// This is handled by the service registry's health checker
	// Load balancer can add additional logic here if needed
}

// getStickySessionService retrieves the sticky session service
func (lb *LoadBalancer) getStickySessionService(serviceName, sessionID string) *ServiceInfo {
	key := fmt.Sprintf("sticky:%s:%s", serviceName, sessionID)
	serviceID, err := lb.registry.redisClient.Get(context.Background(), key).Result()
	if err != nil {
		return nil
	}

	services, err := lb.registry.DiscoverServices(context.Background(), serviceName)
	if err != nil {
		return nil
	}

	for _, service := range services {
		if service.ID == serviceID && service.Healthy {
			return service
		}
	}

	return nil
}

// setStickySessionService stores the sticky session service
func (lb *LoadBalancer) setStickySessionService(serviceName, sessionID, serviceID string) {
	key := fmt.Sprintf("sticky:%s:%s", serviceName, sessionID)
	lb.registry.redisClient.Set(context.Background(), key, serviceID, 24*time.Hour)
}

// ReleaseConnection releases a connection for least connections strategy
func (lb *LoadBalancer) ReleaseConnection(serviceID string) {
	lb.mu.Lock()
	if count, exists := lb.connections[serviceID]; exists && count > 0 {
		lb.connections[serviceID]--
	}
	lb.mu.Unlock()
}

// GetServiceMetrics returns metrics for services
func (lb *LoadBalancer) GetServiceMetrics(ctx context.Context, serviceName string) (map[string]interface{}, error) {
	services, err := lb.registry.DiscoverServices(ctx, serviceName)
	if err != nil {
		return nil, err
	}

	metrics := make(map[string]interface{})
	metrics["total_instances"] = len(services)
	metrics["healthy_instances"] = 0
	metrics["unhealthy_instances"] = 0
	metrics["average_response_time"] = time.Duration(0)
	metrics["total_requests"] = 0

	var totalResponseTime time.Duration
	for _, service := range services {
		if service.Healthy {
			metrics["healthy_instances"] = metrics["healthy_instances"].(int) + 1
		} else {
			metrics["unhealthy_instances"] = metrics["unhealthy_instances"].(int) + 1
		}

		totalResponseTime += service.ResponseTime
		metrics["total_requests"] = metrics["total_requests"].(int) + service.SuccessCount + service.ErrorCount
	}

	if len(services) > 0 {
		metrics["average_response_time"] = totalResponseTime / time.Duration(len(services))
	}

	return metrics, nil
}
