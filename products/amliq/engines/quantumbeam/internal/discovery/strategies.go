//go:build legacy_migrated
// +build legacy_migrated

package discovery

import (
	"hash/crc32"
	"math/rand"
	"sort"
	"sync"
	"time"
)

// RoundRobinStrategy implements round-robin load balancing
type RoundRobinStrategy struct {
	counters map[string]int
	mu       sync.Mutex
}

// SelectService selects the next service in round-robin order
func (rr *RoundRobinStrategy) SelectService(services []*ServiceInfo, requestContext *RequestContext) *ServiceInfo {
	if len(services) == 0 {
		return nil
	}

	rr.mu.Lock()
	defer rr.mu.Unlock()

	serviceName := services[0].Name
	counter := rr.counters[serviceName]
	selectedService := services[counter%len(services)]
	rr.counters[serviceName] = counter + 1

	return selectedService
}

// WeightedRoundRobinStrategy implements weighted round-robin load balancing
type WeightedRoundRobinStrategy struct {
	counters map[string]int
	mu       sync.Mutex
}

// SelectService selects service based on weights with round-robin
func (wrr *WeightedRoundRobinStrategy) SelectService(services []*ServiceInfo, requestContext *RequestContext) *ServiceInfo {
	if len(services) == 0 {
		return nil
	}

	// Calculate total weight
	totalWeight := 0
	for _, service := range services {
		if service.Weight <= 0 {
			service.Weight = 1 // Default weight
		}
		totalWeight += service.Weight
	}

	if totalWeight == 0 {
		// Fallback to simple round-robin
		rr := &RoundRobinStrategy{counters: wrr.counters}
		return rr.SelectService(services, requestContext)
	}

	wrr.mu.Lock()
	defer wrr.mu.Unlock()

	serviceName := services[0].Name
	counter := wrr.counters[serviceName]
	selectedWeight := counter % totalWeight

	// Find service based on weight
	currentWeight := 0
	for _, service := range services {
		currentWeight += service.Weight
		if selectedWeight < currentWeight {
			wrr.counters[serviceName] = counter + 1
			return service
		}
	}

	// Fallback (should not reach here)
	wrr.counters[serviceName] = counter + 1
	return services[0]
}

// LeastConnectionsStrategy implements least connections load balancing
type LeastConnectionsStrategy struct {
	connections map[string]int
	mu          sync.Mutex
}

// SelectService selects service with the least active connections
func (lc *LeastConnectionsStrategy) SelectService(services []*ServiceInfo, requestContext *RequestContext) *ServiceInfo {
	if len(services) == 0 {
		return nil
	}

	lc.mu.Lock()
	defer lc.mu.Unlock()

	var selectedService *ServiceInfo
	minConnections := int(^uint(0) >> 1) // Max int

	for _, service := range services {
		connections := lc.connections[service.ID]
		if connections < minConnections {
			minConnections = connections
			selectedService = service
		}
	}

	return selectedService
}

// RandomStrategy implements random load balancing
type RandomStrategy struct {
	rand *rand.Rand
	mu   sync.Mutex
}

// SelectService selects a random service
func (rs *RandomStrategy) SelectService(services []*ServiceInfo, requestContext *RequestContext) *ServiceInfo {
	if len(services) == 0 {
		return nil
	}

	rs.mu.Lock()
	if rs.rand == nil {
		rs.rand = rand.New(rand.NewSource(time.Now().UnixNano()))
	}
	index := rs.rand.Intn(len(services))
	rs.mu.Unlock()

	return services[index]
}

// ConsistentHashStrategy implements consistent hashing load balancing
type ConsistentHashStrategy struct {
	hash func(data []byte) uint32
}

// SelectService selects service based on consistent hash
func (ch *ConsistentHashStrategy) SelectService(services []*ServiceInfo, requestContext *RequestContext) *ServiceInfo {
	if len(services) == 0 {
		return nil
	}

	if ch.hash == nil {
		ch.hash = crc32.ChecksumIEEE
	}

	// Use request key or fallback to path
	key := requestContext.Key
	if key == "" {
		key = requestContext.Path
	}

	if key == "" {
		// Fallback to random
		rs := &RandomStrategy{}
		return rs.SelectService(services, requestContext)
	}

	hash := ch.hash([]byte(key))
	index := int(hash) % len(services)
	return services[index]
}

// IPHashStrategy implements IP hash load balancing
type IPHashStrategy struct {
	hash func(data []byte) uint32
}

// SelectService selects service based on client IP hash
func (ih *IPHashStrategy) SelectService(services []*ServiceInfo, requestContext *RequestContext) *ServiceInfo {
	if len(services) == 0 {
		return nil
	}

	if ih.hash == nil {
		ih.hash = crc32.ChecksumIEEE
	}

	if requestContext.IP == "" {
		// Fallback to random
		rs := &RandomStrategy{}
		return rs.SelectService(services, requestContext)
	}

	hash := ih.hash([]byte(requestContext.IP))
	index := int(hash) % len(services)
	return services[index]
}

// ResponseTimeStrategy implements response time-based load balancing
type ResponseTimeStrategy struct{}

// SelectService selects service with the best response time
func (rt *ResponseTimeStrategy) SelectService(services []*ServiceInfo, requestContext *RequestContext) *ServiceInfo {
	if len(services) == 0 {
		return nil
	}

	var selectedService *ServiceInfo
	bestResponseTime := time.Hour // Initialize with a large duration

	for _, service := range services {
		if service.ResponseTime < bestResponseTime {
			bestResponseTime = service.ResponseTime
			selectedService = service
		}
	}

	return selectedService
}

// ResourceBasedStrategy implements resource-based load balancing
type ResourceBasedStrategy struct{}

// SelectService selects service based on resource utilization
func (rb *ResourceBasedStrategy) SelectService(services []*ServiceInfo, requestContext *RequestContext) *ServiceInfo {
	if len(services) == 0 {
		return nil
	}

	// Sort services by error rate (success_count / (success_count + error_count))
	// and response time
	sort.Slice(services, func(i, j int) bool {
		si, sj := services[i], services[j]

		// Calculate success rates
		siTotal := si.SuccessCount + si.ErrorCount
		sjTotal := sj.SuccessCount + sj.ErrorCount

		var siSuccessRate, sjSuccessRate float64
		if siTotal > 0 {
			siSuccessRate = float64(si.SuccessCount) / float64(siTotal)
		}
		if sjTotal > 0 {
			sjSuccessRate = float64(sj.SuccessCount) / float64(sjTotal)
		}

		// Prefer higher success rate, then lower response time
		if siSuccessRate != sjSuccessRate {
			return siSuccessRate > sjSuccessRate
		}
		return si.ResponseTime < sj.ResponseTime
	})

	return services[0]
}

// GeographicStrategy implements geographic load balancing
type GeographicStrategy struct{}

// SelectService selects service based on geographic proximity
func (gs *GeographicStrategy) SelectService(services []*ServiceInfo, requestContext *RequestContext) *ServiceInfo {
	if len(services) == 0 {
		return nil
	}

	// Extract region from metadata or use service region
	var sameRegionServices []*ServiceInfo
	clientRegion := requestContext.Headers["X-Client-Region"]
	if clientRegion == "" {
		// Fallback to first available service
		return services[0]
	}

	// Find services in the same region
	for _, service := range services {
		if service.Region == clientRegion {
			sameRegionServices = append(sameRegionServices, service)
		}
	}

	// If services in same region found, use round-robin among them
	if len(sameRegionServices) > 0 {
		rr := &RoundRobinStrategy{counters: make(map[string]int)}
		return rr.SelectService(sameRegionServices, requestContext)
	}

	// Fallback to any service
	return services[0]
}

// ZoneAwareStrategy implements zone-aware load balancing
type ZoneAwareStrategy struct{}

// SelectService selects service based on zone awareness
func (zas *ZoneAwareStrategy) SelectService(services []*ServiceInfo, requestContext *RequestContext) *ServiceInfo {
	if len(services) == 0 {
		return nil
	}

	// Extract zone from metadata or use service zone
	var sameZoneServices []*ServiceInfo
	clientZone := requestContext.Headers["X-Client-Zone"]
	if clientZone == "" {
		// Fallback to geographic strategy
		gs := &GeographicStrategy{}
		return gs.SelectService(services, requestContext)
	}

	// Find services in the same zone
	for _, service := range services {
		if service.Zone == clientZone {
			sameZoneServices = append(sameZoneServices, service)
		}
	}

	// If services in same zone found, use round-robin among them
	if len(sameZoneServices) > 0 {
		rr := &RoundRobinStrategy{counters: make(map[string]int)}
		return rr.SelectService(sameZoneServices, requestContext)
	}

	// Try same region, different zone
	clientRegion := requestContext.Headers["X-Client-Region"]
	var sameRegionServices []*ServiceInfo
	for _, service := range services {
		if service.Region == clientRegion && service.Zone != clientZone {
			sameRegionServices = append(sameRegionServices, service)
		}
	}

	if len(sameRegionServices) > 0 {
		rr := &RoundRobinStrategy{counters: make(map[string]int)}
		return rr.SelectService(sameRegionServices, requestContext)
	}

	// Fallback to any service
	return services[0]
}

// VersionAwareStrategy implements version-aware load balancing
type VersionAwareStrategy struct{}

// SelectService selects service based on version compatibility
func (vas *VersionAwareStrategy) SelectService(services []*ServiceInfo, requestContext *RequestContext) *ServiceInfo {
	if len(services) == 0 {
		return nil
	}

	// Get requested version from headers
	requestedVersion := requestContext.Headers["API-Version"]
	if requestedVersion == "" {
		// Use latest version
		latestVersion := vas.getLatestVersion(services)
		return vas.selectByVersion(services, latestVersion, requestContext)
	}

	// Try to find services with requested version
	versionServices := vas.selectByVersion(services, requestedVersion, requestContext)
	if len(versionServices) > 0 {
		return versionServices[0]
	}

	// Fallback to compatible versions
	compatibleVersion := vas.findCompatibleVersion(requestedVersion, services)
	if compatibleVersion != "" {
		return vas.selectByVersion(services, compatibleVersion, requestContext)[0]
	}

	// Fallback to latest version
	latestVersion := vas.getLatestVersion(services)
	return vas.selectByVersion(services, latestVersion, requestContext)[0]
}

// getLatestVersion returns the latest version among services
func (vas *VersionAwareStrategy) getLatestVersion(services []*ServiceInfo) string {
	if len(services) == 0 {
		return ""
	}

	latest := services[0].Version
	for _, service := range services[1:] {
		if vas.compareVersions(service.Version, latest) > 0 {
			latest = service.Version
		}
	}
	return latest
}

// selectByVersion returns services matching the specified version
func (vas *VersionAwareStrategy) selectByVersion(services []*ServiceInfo, version string, requestContext *RequestContext) []*ServiceInfo {
	var matchingServices []*ServiceInfo
	for _, service := range services {
		if service.Version == version {
			matchingServices = append(matchingServices, service)
		}
	}

	if len(matchingServices) == 0 {
		return matchingServices
	}

	// Use round-robin among matching services
	rr := &RoundRobinStrategy{counters: make(map[string]int)}
	return []*ServiceInfo{rr.SelectService(matchingServices, requestContext)}
}

// findCompatibleVersion finds a compatible version
func (vas *VersionAwareStrategy) findCompatibleVersion(requestedVersion string, services []*ServiceInfo) string {
	// Simple semantic version compatibility
	// Major version must match, minor version can be lower
	for _, service := range services {
		if vas.isCompatible(requestedVersion, service.Version) {
			return service.Version
		}
	}
	return ""
}

// isCompatible checks version compatibility
func (vas *VersionAwareStrategy) isCompatible(requested, available string) bool {
	// Simple implementation - same major version
	reqMajor := vas.extractMajor(requested)
	availMajor := vas.extractMajor(available)
	return reqMajor == availMajor
}

// extractMajor extracts major version from version string
func (vas *VersionAwareStrategy) extractMajor(version string) string {
	if len(version) == 0 {
		return "0"
	}

	// Simple parsing - assume format "X.Y.Z" or "X.Y"
	for i, char := range version {
		if char == '.' {
			return version[:i]
		}
	}
	return version
}

// compareVersions compares two version strings
func (vas *VersionAwareStrategy) compareVersions(v1, v2 string) int {
	// Simple semantic version comparison
	if v1 == v2 {
		return 0
	}
	if v1 > v2 {
		return 1
	}
	return -1
}

// CustomHashStrategy allows custom hash function for consistent hashing
type CustomHashStrategy struct {
	hashFunc func(string) uint32
}

// SelectService selects service using custom hash function
func (chs *CustomHashStrategy) SelectService(services []*ServiceInfo, requestContext *RequestContext) *ServiceInfo {
	if len(services) == 0 {
		return nil
	}

	if chs.hashFunc == nil {
		// Fallback to consistent hash
		ch := &ConsistentHashStrategy{}
		return ch.SelectService(services, requestContext)
	}

	key := requestContext.Key
	if key == "" {
		key = requestContext.Path
	}

	if key == "" {
		// Fallback to random
		rs := &RandomStrategy{}
		return rs.SelectService(services, requestContext)
	}

	hash := chs.hashFunc(key)
	index := int(hash) % len(services)
	return services[index]
}

// NewCustomHashStrategy creates a new custom hash strategy
func NewCustomHashStrategy(hashFunc func(string) uint32) *CustomHashStrategy {
	return &CustomHashStrategy{
		hashFunc: hashFunc,
	}
}

// LoadBalancingStrategyFactory creates load balancing strategies
type LoadBalancingStrategyFactory struct{}

// CreateStrategy creates a load balancing strategy by name
func (f *LoadBalancingStrategyFactory) CreateStrategy(name string, config map[string]interface{}) LoadBalancingStrategy {
	switch strings.ToLower(name) {
	case "round_robin", "round-robin":
		return &RoundRobinStrategy{counters: make(map[string]int)}
	case "weighted_round_robin", "weighted-round-robin":
		return &WeightedRoundRobinStrategy{counters: make(map[string]int)}
	case "least_connections", "least-connections":
		return &LeastConnectionsStrategy{connections: make(map[string]int)}
	case "random":
		return &RandomStrategy{}
	case "consistent_hash", "consistent-hash":
		return &ConsistentHashStrategy{}
	case "ip_hash", "ip-hash":
		return &IPHashStrategy{}
	case "response_time", "response-time":
		return &ResponseTimeStrategy{}
	case "resource_based", "resource-based":
		return &ResourceBasedStrategy{}
	case "geographic":
		return &GeographicStrategy{}
	case "zone_aware", "zone-aware":
		return &ZoneAwareStrategy{}
	case "version_aware", "version-aware":
		return &VersionAwareStrategy{}
	case "custom_hash", "custom-hash":
		if hashFunc, ok := config["hash_func"].(func(string) uint32); ok {
			return NewCustomHashStrategy(hashFunc)
		}
		return &ConsistentHashStrategy{}
	default:
		return &WeightedRoundRobinStrategy{counters: make(map[string]int)}
	}
}

// GetAllStrategies returns all available strategy names
func (f *LoadBalancingStrategyFactory) GetAllStrategies() []string {
	return []string{
		"round_robin",
		"weighted_round_robin",
		"least_connections",
		"random",
		"consistent_hash",
		"ip_hash",
		"response_time",
		"resource_based",
		"geographic",
		"zone_aware",
		"version_aware",
		"custom_hash",
	}
}