package discovery

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/circuitbreaker"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/config"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/observability"
)

// ServiceInstance represents a service instance
type ServiceInstance struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	Address   string            `json:"address"`
	Port      int               `json:"port"`
	Protocol  string            `json:"protocol"`
	Tags      []string          `json:"tags"`
	Metadata  map[string]string `json:"metadata"`
	Status    InstanceStatus    `json:"status"`
	Health    HealthCheck       `json:"health"`
	Weight    int               `json:"weight"`
	Priority  int               `json:"priority"`
	LastSeen  time.Time         `json:"last_seen"`
	CreatedAt time.Time         `json:"created_at"`
	UpdatedAt time.Time         `json:"updated_at"`
}

// InstanceStatus represents the status of a service instance
type InstanceStatus string

const (
	StatusStarting  InstanceStatus = "starting"
	StatusHealthy   InstanceStatus = "healthy"
	StatusUnhealthy InstanceStatus = "unhealthy"
	StatusDraining  InstanceStatus = "draining"
	StatusOffline   InstanceStatus = "offline"
)

// HealthCheck represents health check information
type HealthCheck struct {
	Endpoint   string        `json:"endpoint"`
	Interval   time.Duration `json:"interval"`
	Timeout    time.Duration `json:"timeout"`
	LastCheck  time.Time     `json:"last_check"`
	Status     string        `json:"status"`
	Message    string        `json:"message"`
	CheckCount int64         `json:"check_count"`
	FailCount  int64         `json:"fail_count"`
}

// LoadBalanceAlgorithm represents different load balancing algorithms
type LoadBalanceAlgorithm string

const (
	AlgorithmRoundRobin         LoadBalanceAlgorithm = "round_robin"
	AlgorithmWeightedRoundRobin LoadBalanceAlgorithm = "weighted_round_robin"
	AlgorithmLeastConnections   LoadBalanceAlgorithm = "least_connections"
	AlgorithmRandom             LoadBalanceAlgorithm = "random"
	AlgorithmHash               LoadBalanceAlgorithm = "hash"
	AlgorithmIPHash             LoadBalanceAlgorithm = "ip_hash"
)

// ServiceRegistry manages service instances and load balancing
type ServiceRegistry struct {
	config        *config.Config
	services      map[string]*Service
	mutex         sync.RWMutex
	logger        *logrus.Entry
	traceHelper   *observability.TraceHelper
	cbRegistry    *circuitbreaker.Registry
	healthChecker *HealthChecker
	tracer        trace.Tracer
}

// Service represents a service with its instances
type Service struct {
	Name       string                      `json:"name"`
	Instances  map[string]*ServiceInstance `json:"instances"`
	Algorithm  LoadBalanceAlgorithm        `json:"algorithm"`
	Settings   ServiceSettings             `json:"settings"`
	Stats      ServiceStats                `json:"stats"`
	mutex      sync.RWMutex
	roundRobin uint64 // atomic counter for round-robin
}

// ServiceSettings holds service-specific settings
type ServiceSettings struct {
	HealthCheckInterval  time.Duration `json:"health_check_interval"`
	HealthCheckTimeout   time.Duration `json:"health_check_timeout"`
	MaxFailures          int           `json:"max_failures"`
	RecoveryTime         time.Duration `json:"recovery_time"`
	ConnectionTimeout    time.Duration `json:"connection_timeout"`
	RequestTimeout       time.Duration `json:"request_timeout"`
	Retries              int           `json:"retries"`
	EnableCircuitBreaker bool          `json:"enable_circuit_breaker"`
}

// ServiceStats holds service statistics
type ServiceStats struct {
	TotalRequests      int64         `json:"total_requests"`
	SuccessfulRequests int64         `json:"successful_requests"`
	FailedRequests     int64         `json:"failed_requests"`
	AverageLatency     time.Duration `json:"average_latency"`
	P95Latency         time.Duration `json:"p95_latency"`
	P99Latency         time.Duration `json:"p99_latency"`
	LastRequest        time.Time     `json:"last_request"`
}

// NewServiceRegistry creates a new service registry
func NewServiceRegistry(config *config.Config) *ServiceRegistry {
	registry := &ServiceRegistry{
		config:   config,
		services: make(map[string]*Service),
		logger: logrus.WithFields(logrus.Fields{
			"component": "service_registry",
		}),
		traceHelper: observability.GetGlobalTraceHelper("service_discovery"),
		cbRegistry:  circuitbreaker.GetGlobalRegistry(),
		tracer:      otel.Tracer("service_discovery"),
	}

	// Initialize health checker
	registry.healthChecker = NewHealthChecker(registry)

	return registry
}

// RegisterService registers a new service instance
func (sr *ServiceRegistry) RegisterService(ctx context.Context, instance *ServiceInstance) error {
	ctx, span := sr.tracer.Start(ctx, "service_registry.register")
	defer span.End()

	if instance == nil {
		return fmt.Errorf("service instance cannot be nil")
	}

	if instance.ID == "" {
		return fmt.Errorf("service instance ID cannot be empty")
	}

	if instance.Name == "" {
		return fmt.Errorf("service name cannot be empty")
	}

	sr.mutex.Lock()
	defer sr.mutex.Unlock()

	// Get or create service
	service, exists := sr.services[instance.Name]
	if !exists {
		service = &Service{
			Name:      instance.Name,
			Instances: make(map[string]*ServiceInstance),
			Algorithm: AlgorithmRoundRobin,
			Settings: ServiceSettings{
				HealthCheckInterval:  30 * time.Second,
				HealthCheckTimeout:   5 * time.Second,
				MaxFailures:          3,
				RecoveryTime:         30 * time.Second,
				ConnectionTimeout:    10 * time.Second,
				RequestTimeout:       30 * time.Second,
				Retries:              2,
				EnableCircuitBreaker: true,
			},
		}
		sr.services[instance.Name] = service
	}

	// Set timestamps
	now := time.Now()
	if instance.CreatedAt.IsZero() {
		instance.CreatedAt = now
	}
	instance.UpdatedAt = now
	instance.LastSeen = now

	// Add or update instance
	service.mutex.Lock()
	service.Instances[instance.ID] = instance
	service.mutex.Unlock()

	sr.logger.WithFields(logrus.Fields{
		"service":     instance.Name,
		"instance_id": instance.ID,
		"address":     fmt.Sprintf("%s:%d", instance.Address, instance.Port),
	}).Info("Service instance registered")

	// Start health checking for this service
	go sr.healthChecker.StartHealthCheck(ctx, instance.Name, instance.ID)

	return nil
}

// UnregisterService removes a service instance
func (sr *ServiceRegistry) UnregisterService(ctx context.Context, serviceName, instanceID string) error {
	ctx, span := sr.tracer.Start(ctx, "service_registry.unregister")
	defer span.End()

	sr.mutex.RLock()
	service, exists := sr.services[serviceName]
	sr.mutex.RUnlock()

	if !exists {
		return fmt.Errorf("service %s not found", serviceName)
	}

	service.mutex.Lock()
	delete(service.Instances, instanceID)
	service.mutex.Unlock()

	sr.logger.WithFields(logrus.Fields{
		"service":     serviceName,
		"instance_id": instanceID,
	}).Info("Service instance unregistered")

	return nil
}

// GetInstance selects an instance using the configured load balancing algorithm
func (sr *ServiceRegistry) GetInstance(ctx context.Context, serviceName string, key string) (*ServiceInstance, error) {
	ctx, span := sr.tracer.Start(ctx, "service_registry.get_instance",
		trace.WithAttributes(
			attribute.String("service.name", serviceName),
			attribute.String("load_balance.key", key),
		))
	defer span.End()

	sr.mutex.RLock()
	service, exists := sr.services[serviceName]
	sr.mutex.RUnlock()

	if !exists {
		return nil, fmt.Errorf("service %s not found", serviceName)
	}

	// Filter healthy instances
	healthyInstances := sr.getHealthyInstances(service)
	if len(healthyInstances) == 0 {
		return nil, fmt.Errorf("no healthy instances available for service %s", serviceName)
	}

	// Select instance based on algorithm
	instance, err := sr.selectInstance(ctx, service, healthyInstances, key)
	if err != nil {
		return nil, fmt.Errorf("failed to select instance: %w", err)
	}

	// Update statistics
	atomic.AddInt64(&service.Stats.TotalRequests, 1)
	service.Stats.LastRequest = time.Now()

	sr.logger.WithFields(logrus.Fields{
		"service":     serviceName,
		"instance_id": instance.ID,
		"algorithm":   service.Algorithm,
	}).Debug("Service instance selected")

	return instance, nil
}

// getHealthyInstances returns only healthy instances
func (sr *ServiceRegistry) getHealthyInstances(service *Service) []*ServiceInstance {
	service.mutex.RLock()
	defer service.mutex.RUnlock()

	var healthy []*ServiceInstance
	for _, instance := range service.Instances {
		if instance.Status == StatusHealthy && instance.Health.Status == "healthy" {
			healthy = append(healthy, instance)
		}
	}
	return healthy
}

// selectInstance selects an instance based on the load balancing algorithm
func (sr *ServiceRegistry) selectInstance(ctx context.Context, service *Service, instances []*ServiceInstance, key string) (*ServiceInstance, error) {
	if len(instances) == 0 {
		return nil, fmt.Errorf("no instances available")
	}

	switch service.Algorithm {
	case AlgorithmRoundRobin:
		return sr.selectRoundRobin(instances)
	case AlgorithmWeightedRoundRobin:
		return sr.selectWeightedRoundRobin(instances)
	case AlgorithmLeastConnections:
		return sr.selectLeastConnections(instances)
	case AlgorithmRandom:
		return sr.selectRandom(instances)
	case AlgorithmHash:
		return sr.selectHash(instances, key)
	case AlgorithmIPHash:
		return sr.selectIPHash(instances, key)
	default:
		return sr.selectRoundRobin(instances)
	}
}

// selectRoundRobin implements round-robin load balancing
func (sr *ServiceRegistry) selectRoundRobin(instances []*ServiceInstance) (*ServiceInstance, error) {
	if len(instances) == 0 {
		return nil, fmt.Errorf("no instances available")
	}

	index := atomic.AddUint64(&sr.services[instances[0].Name].roundRobin, 1) - 1
	return instances[index%uint64(len(instances))], nil
}

// selectWeightedRoundRobin implements weighted round-robin load balancing
func (sr *ServiceRegistry) selectWeightedRoundRobin(instances []*ServiceInstance) (*ServiceInstance, error) {
	if len(instances) == 0 {
		return nil, fmt.Errorf("no instances available")
	}

	totalWeight := 0
	for _, instance := range instances {
		if instance.Weight <= 0 {
			instance.Weight = 1
		}
		totalWeight += instance.Weight
	}

	if totalWeight == 0 {
		return instances[0], nil
	}

	target := atomic.AddUint64(&sr.services[instances[0].Name].roundRobin, 1) % uint64(totalWeight)
	currentWeight := 0

	for _, instance := range instances {
		currentWeight += instance.Weight
		if currentWeight >= 0 && uint64(currentWeight) > target {
			return instance, nil
		}
	}

	return instances[0], nil
}

// selectLeastConnections implements least connections load balancing
func (sr *ServiceRegistry) selectLeastConnections(instances []*ServiceInstance) (*ServiceInstance, error) {
	if len(instances) == 0 {
		return nil, fmt.Errorf("no instances available")
	}

	selected := instances[0]
	minConnections := atomic.LoadInt64(&sr.services[instances[0].Name].Stats.TotalRequests)

	for _, instance := range instances[1:] {
		connections := atomic.LoadInt64(&sr.services[instance.Name].Stats.TotalRequests)
		if connections < minConnections {
			selected = instance
			minConnections = connections
		}
	}

	return selected, nil
}

// selectRandom implements random load balancing
func (sr *ServiceRegistry) selectRandom(instances []*ServiceInstance) (*ServiceInstance, error) {
	if len(instances) == 0 {
		return nil, fmt.Errorf("no instances available")
	}

	// Simple hash-based random selection
	hash := uint64(time.Now().UnixNano())
	index := hash % uint64(len(instances))
	return instances[index], nil
}

// selectHash implements hash-based load balancing
func (sr *ServiceRegistry) selectHash(instances []*ServiceInstance, key string) (*ServiceInstance, error) {
	if len(instances) == 0 {
		return nil, fmt.Errorf("no instances available")
	}

	if key == "" {
		return sr.selectRandom(instances)
	}

	// Simple hash function
	hash := 0
	for _, char := range key {
		hash = hash*31 + int(char)
	}
	if hash < 0 {
		hash = -hash
	}

	index := hash % len(instances)
	return instances[index], nil
}

// selectIPHash implements IP hash load balancing
func (sr *ServiceRegistry) selectIPHash(instances []*ServiceInstance, clientIP string) (*ServiceInstance, error) {
	return sr.selectHash(instances, clientIP)
}

// GetServiceInstances returns all instances for a service
func (sr *ServiceRegistry) GetServiceInstances(serviceName string) ([]*ServiceInstance, error) {
	sr.mutex.RLock()
	service, exists := sr.services[serviceName]
	sr.mutex.RUnlock()

	if !exists {
		return nil, fmt.Errorf("service %s not found", serviceName)
	}

	service.mutex.RLock()
	defer service.mutex.RUnlock()

	instances := make([]*ServiceInstance, 0, len(service.Instances))
	for _, instance := range service.Instances {
		instances = append(instances, instance)
	}

	return instances, nil
}

// ListServices returns all registered services
func (sr *ServiceRegistry) ListServices() []string {
	sr.mutex.RLock()
	defer sr.mutex.RUnlock()

	services := make([]string, 0, len(sr.services))
	for name := range sr.services {
		services = append(services, name)
	}

	sort.Strings(services)
	return services
}

// GetServiceStats returns statistics for a service
func (sr *ServiceRegistry) GetServiceStats(serviceName string) (*ServiceStats, error) {
	sr.mutex.RLock()
	service, exists := sr.services[serviceName]
	sr.mutex.RUnlock()

	if !exists {
		return nil, fmt.Errorf("service %s not found", serviceName)
	}

	service.mutex.RLock()
	defer service.mutex.RUnlock()

	// Return a copy to avoid concurrent access
	stats := service.Stats
	return &stats, nil
}

// UpdateInstanceHealth updates the health status of an instance
func (sr *ServiceRegistry) UpdateInstanceHealth(ctx context.Context, serviceName, instanceID string, status string, message string) error {
	sr.mutex.RLock()
	service, exists := sr.services[serviceName]
	sr.mutex.RUnlock()

	if !exists {
		return fmt.Errorf("service %s not found", serviceName)
	}

	service.mutex.Lock()
	defer service.mutex.Unlock()

	instance, exists := service.Instances[instanceID]
	if !exists {
		return fmt.Errorf("instance %s not found", instanceID)
	}

	now := time.Now()
	instance.Health.LastCheck = now
	instance.Health.Status = status
	instance.Health.Message = message
	instance.Health.CheckCount++

	if status != "healthy" {
		instance.Health.FailCount++
	} else {
		instance.Health.FailCount = 0
	}

	// Update instance status based on health
	switch status {
	case "healthy":
		instance.Status = StatusHealthy
	case "unhealthy":
		instance.Status = StatusUnhealthy
	default:
		instance.Status = StatusUnhealthy
	}

	instance.LastSeen = now

	return nil
}

// HealthChecker performs health checks on service instances
type HealthChecker struct {
	registry *ServiceRegistry
	client   *http.Client
	logger   *logrus.Entry
}

// NewHealthChecker creates a new health checker
func NewHealthChecker(registry *ServiceRegistry) *HealthChecker {
	return &HealthChecker{
		registry: registry,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		logger: logrus.WithFields(logrus.Fields{
			"component": "health_checker",
		}),
	}
}

// StartHealthCheck starts health checking for a service instance
func (hc *HealthChecker) StartHealthCheck(ctx context.Context, serviceName, instanceID string) {
	ticker := time.NewTicker(30 * time.Second) // Default interval
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			hc.logger.WithFields(logrus.Fields{
				"service":     serviceName,
				"instance_id": instanceID,
			}).Info("Health checking stopped")
			return
		case <-ticker.C:
			hc.performHealthCheck(ctx, serviceName, instanceID)
		}
	}
}

// performHealthCheck performs a single health check
func (hc *HealthChecker) performHealthCheck(ctx context.Context, serviceName, instanceID string) {
	instances, err := hc.registry.GetServiceInstances(serviceName)
	if err != nil {
		hc.logger.WithError(err).WithField("service", serviceName).Error("Failed to get service instances")
		return
	}

	var targetInstance *ServiceInstance
	for _, instance := range instances {
		if instance.ID == instanceID {
			targetInstance = instance
			break
		}
	}

	if targetInstance == nil {
		hc.logger.WithFields(logrus.Fields{
			"service":     serviceName,
			"instance_id": instanceID,
		}).Warn("Instance not found during health check")
		return
	}

	// Perform health check
	url := fmt.Sprintf("http://%s:%d/health", targetInstance.Address, targetInstance.Port)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		if uErr := hc.registry.UpdateInstanceHealth(ctx, serviceName, instanceID, "unhealthy", fmt.Sprintf("Failed to create request: %v", err)); uErr != nil {
			hc.logger.WithError(uErr).Warn("Failed to update instance health")
		}
		return
	}

	resp, err := hc.client.Do(req)
	if err != nil {
		if uErr := hc.registry.UpdateInstanceHealth(ctx, serviceName, instanceID, "unhealthy", fmt.Sprintf("Health check failed: %v", err)); uErr != nil {
			hc.logger.WithError(uErr).Warn("Failed to update instance health")
		}
		return
	}
	defer func() { _ = resp.Body.Close() }()

	var uErr error
	if resp.StatusCode == http.StatusOK {
		uErr = hc.registry.UpdateInstanceHealth(ctx, serviceName, instanceID, "healthy", "Health check passed")
	} else {
		uErr = hc.registry.UpdateInstanceHealth(ctx, serviceName, instanceID, "unhealthy", fmt.Sprintf("Health check failed with status %d", resp.StatusCode))
	}
	if uErr != nil {
		hc.logger.WithError(uErr).Warn("Failed to update instance health")
	}
}

// SetLoadBalanceAlgorithm sets the load balancing algorithm for a service
func (sr *ServiceRegistry) SetLoadBalanceAlgorithm(serviceName string, algorithm LoadBalanceAlgorithm) error {
	sr.mutex.RLock()
	service, exists := sr.services[serviceName]
	sr.mutex.RUnlock()

	if !exists {
		return fmt.Errorf("service %s not found", serviceName)
	}

	service.mutex.Lock()
	service.Algorithm = algorithm
	service.mutex.Unlock()

	sr.logger.WithFields(logrus.Fields{
		"service":   serviceName,
		"algorithm": algorithm,
	}).Info("Load balancing algorithm updated")

	return nil
}

// GetRegistryInfo returns information about the registry
func (sr *ServiceRegistry) GetRegistryInfo() map[string]interface{} {
	sr.mutex.RLock()
	defer sr.mutex.RUnlock()

	info := map[string]interface{}{
		"total_services": len(sr.services),
		"services":       make(map[string]interface{}),
	}

	for name, service := range sr.services {
		service.mutex.RLock()
		info["services"].(map[string]interface{})[name] = map[string]interface{}{
			"name":      service.Name,
			"algorithm": service.Algorithm,
			"instances": len(service.Instances),
			"stats":     service.Stats,
		}
		service.mutex.RUnlock()
	}

	return info
}

// Global service registry instance
var globalServiceRegistry *ServiceRegistry

// InitializeGlobalServiceRegistry initializes the global service registry
func InitializeGlobalServiceRegistry(config *config.Config) *ServiceRegistry {
	globalServiceRegistry = NewServiceRegistry(config)
	return globalServiceRegistry
}

// GetGlobalServiceRegistry returns the global service registry
func GetGlobalServiceRegistry() *ServiceRegistry {
	return globalServiceRegistry
}
