package tracing

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/opentelemetry.io/otel/attribute"
	"github.com/opentelemetry.io/otel/trace"
)

// TraceAnalytics provides analysis and insights from trace data
type TraceAnalytics struct {
	tracingService *TracingService
	traceStore     *TraceStore
	analysisCache  map[string]*AnalysisResult
	mu             sync.RWMutex
	logger         *log.Logger
}

// TraceStore stores and retrieves trace data for analysis
type TraceStore struct {
	traces  map[string]*StoredTrace
	indexes *TraceIndexes
	maxSize int
	maxAge  time.Duration
	mu      sync.RWMutex
}

// StoredTrace represents a stored trace with metadata
type StoredTrace struct {
	TraceID     string                 `json:"trace_id"`
	SpanCount   int                    `json:"span_count"`
	StartTime   time.Time              `json:"start_time"`
	EndTime     time.Time              `json:"end_time"`
	Duration    time.Duration          `json:"duration"`
	Status      string                 `json:"status"`
	ServiceName string                 `json:"service_name"`
	Operation   string                 `json:"operation"`
	Tags        map[string]string      `json:"tags"`
	Attributes  map[string]interface{} `json:"attributes"`
	SpanTree    *SpanNode              `json:"span_tree"`
	ErrorCount  int                    `json:"error_count"`
	RootSpan    *SpanInfo              `json:"root_span"`
	Metrics     TraceMetrics           `json:"metrics"`
}

// SpanNode represents a node in the span tree
type SpanNode struct {
	SpanInfo *SpanInfo   `json:"span_info"`
	Children []*SpanNode `json:"children"`
	Parent   *SpanNode   `json:"parent,omitempty"`
	Depth    int         `json:"depth"`
	Path     string      `json:"path"`
}

// SpanInfo contains basic span information
type SpanInfo struct {
	SpanID       string                 `json:"span_id"`
	ParentSpanID string                 `json:"parent_span_id"`
	Operation    string                 `json:"operation"`
	ServiceName  string                 `json:"service_name"`
	StartTime    time.Time              `json:"start_time"`
	EndTime      time.Time              `json:"end_time"`
	Duration     time.Duration          `json:"duration"`
	Status       string                 `json:"status"`
	Tags         map[string]string      `json:"tags"`
	Attributes   map[string]interface{} `json:"attributes"`
	Events       []SpanEvent            `json:"events"`
	Links        []Link                 `json:"links"`
}

// TraceIndexes provides indexed access to trace data
type TraceIndexes struct {
	ByService   map[string][]string            `json:"by_service"`
	ByOperation map[string][]string            `json:"by_operation"`
	ByStatus    map[string][]string            `json:"by_status"`
	ByTimeRange map[time.Time][]string         `json:"by_time_range"`
	ByDuration  map[DurationRange][]string     `json:"by_duration"`
	ByError     map[string][]string            `json:"by_error"`
	ByTag       map[string]map[string][]string `json:"by_tag"`
	SlowTraces  []string                       `json:"slow_traces"`
	ErrorTraces []string                       `json:"error_traces"`
	LastUpdated time.Time                      `json:"last_updated"`
}

// DurationRange represents a duration range for indexing
type DurationRange struct {
	Min time.Duration `json:"min"`
	Max time.Duration `json:"max"`
}

// AnalysisResult contains the results of trace analysis
type AnalysisResult struct {
	TraceID         string                 `json:"trace_id"`
	AnalysisType    string                 `json:"analysis_type"`
	GeneratedAt     time.Time              `json:"generated_at"`
	Summary         TraceSummary           `json:"summary"`
	Performance     PerformanceAnalysis    `json:"performance"`
	Dependencies    DependencyAnalysis     `json:"dependencies"`
	Errors          ErrorAnalysis          `json:"errors"`
	Anomalies       []Anomaly              `json:"anomalies"`
	Recommendations []string               `json:"recommendations"`
	Insights        map[string]interface{} `json:"insights"`
}

// TraceSummary provides a high-level summary of a trace
type TraceSummary struct {
	TotalSpans       int           `json:"total_spans"`
	TotalDuration    time.Duration `json:"total_duration"`
	ServicesInvolved []string      `json:"services_involved"`
	OperationPath    []string      `json:"operation_path"`
	CriticalPath     time.Duration `json:"critical_path"`
	ErrorCount       int           `json:"error_count"`
	SuccessRate      float64       `json:"success_rate"`
	AverageLatency   time.Duration `json:"average_latency"`
	P95Latency       time.Duration `json:"p95_latency"`
	P99Latency       time.Duration `json:"p99_latency"`
}

// PerformanceAnalysis analyzes performance aspects of traces
type PerformanceAnalysis struct {
	SlowestSpans  []SpanLatency      `json:"slowest_spans"`
	CriticalPath  []string           `json:"critical_path"`
	Bottlenecks   []Bottleneck       `json:"bottlenecks"`
	ResourceUsage ResourceMetrics    `json:"resource_usage"`
	Throughput    ThroughputMetrics  `json:"throughput"`
	Concurrency   ConcurrencyMetrics `json:"concurrency"`
}

// SpanLatency represents latency information for a span
type SpanLatency struct {
	SpanID      string        `json:"span_id"`
	Operation   string        `json:"operation"`
	ServiceName string        `json:"service_name"`
	Duration    time.Duration `json:"duration"`
	Percentile  float64       `json:"percentile"`
}

// Bottleneck represents a performance bottleneck
type Bottleneck struct {
	SpanID         string        `json:"span_id"`
	Operation      string        `json:"operation"`
	ServiceName    string        `json:"service_name"`
	Duration       time.Duration `json:"duration"`
	Impact         string        `json:"impact"`
	Recommendation string        `json:"recommendation"`
}

// ResourceMetrics contains resource usage metrics
type ResourceMetrics struct {
	CPUUsage     float64 `json:"cpu_usage"`
	MemoryUsage  float64 `json:"memory_usage"`
	IOOperations int     `json:"io_operations"`
	NetworkIO    int64   `json:"network_io"`
}

// ThroughputMetrics contains throughput information
type ThroughputMetrics struct {
	RequestsPerSecond float64     `json:"requests_per_second"`
	DataTransferRate  float64     `json:"data_transfer_rate"`
	Timestamps        []time.Time `json:"timestamps"`
}

// ConcurrencyMetrics contains concurrency information
type ConcurrencyMetrics struct {
	MaxConcurrentSpans  int                   `json:"max_concurrent_spans"`
	AverageConcurrency  float64               `json:"average_concurrency"`
	ConcurrencyOverTime []ConcurrencySnapshot `json:"concurrency_over_time"`
}

// ConcurrencySnapshot represents concurrency at a point in time
type ConcurrencySnapshot struct {
	Timestamp  time.Time `json:"timestamp"`
	Concurrent int       `json:"concurrent"`
}

// DependencyAnalysis analyzes service dependencies
type DependencyAnalysis struct {
	ServiceMap     ServiceDependencyMap `json:"service_map"`
	CallGraph      CallGraph            `json:"call_graph"`
	DependencyTree DependencyTree       `json:"dependency_tree"`
	CriticalPath   []string             `json:"critical_path"`
	SLACompliance  SLAAnalysis          `json:"sla_compliance"`
}

// ServiceDependencyMap maps service dependencies
type ServiceDependencyMap struct {
	Services map[string]ServiceDependencies `json:"services"`
}

// ServiceDependencies represents dependencies for a service
type ServiceDependencies struct {
	Upstream   []ServiceLink `json:"upstream"`
	Downstream []ServiceLink `json:"downstream"`
	Peers      []ServiceLink `json:"peers"`
}

// ServiceLink represents a link between services
type ServiceLink struct {
	ServiceName    string        `json:"service_name"`
	Operation      string        `json:"operation"`
	CallCount      int           `json:"call_count"`
	AverageLatency time.Duration `json:"average_latency"`
	ErrorRate      float64       `json:"error_rate"`
}

// CallGraph represents the call graph of services
type CallGraph struct {
	Nodes []CallNode `json:"nodes"`
	Edges []CallEdge `json:"edges"`
}

// CallNode represents a node in the call graph
type CallNode struct {
	ID          string `json:"id"`
	ServiceName string `json:"service_name"`
	Operation   string `json:"operation"`
	Count       int    `json:"count"`
}

// CallEdge represents an edge in the call graph
type CallEdge struct {
	From           string        `json:"from"`
	To             string        `json:"to"`
	CallCount      int           `json:"call_count"`
	AverageLatency time.Duration `json:"average_latency"`
	ErrorRate      float64       `json:"error_rate"`
}

// DependencyTree represents a tree of service dependencies
type DependencyTree struct {
	Root *DependencyNode `json:"root"`
}

// DependencyNode represents a node in the dependency tree
type DependencyNode struct {
	ServiceName  string                 `json:"service_name"`
	Dependencies []*DependencyNode      `json:"dependencies"`
	Metadata     map[string]interface{} `json:"metadata"`
}

// SLAAnalysis contains SLA compliance analysis
type SLAAnalysis struct {
	OverallCompliance float64               `json:"overall_compliance"`
	ServiceSLAs       map[string]ServiceSLA `json:"service_slas"`
	Violations        []SLAViolation        `json:"violations"`
	Trends            SLATrend              `json:"trends"`
}

// ServiceSLA represents SLA metrics for a service
type ServiceSLA struct {
	ServiceName  string        `json:"service_name"`
	Availability float64       `json:"availability"`
	LatencyP95   time.Duration `json:"latency_p95"`
	LatencyP99   time.Duration `json:"latency_p99"`
	ErrorRate    float64       `json:"error_rate"`
	Throughput   float64       `json:"throughput"`
}

// SLAViolation represents an SLA violation
type SLAViolation struct {
	ServiceName   string    `json:"service_name"`
	MetricType    string    `json:"metric_type"`
	ExpectedValue float64   `json:"expected_value"`
	ActualValue   float64   `json:"actual_value"`
	ViolationTime time.Time `json:"violation_time"`
	Severity      string    `json:"severity"`
}

// SLATrend represents SLA trends over time
type SLATrend struct {
	MetricName string              `json:"metric_name"`
	DataPoints []SLATrendDataPoint `json:"data_points"`
	Trend      string              `json:"trend"`
}

// SLATrendDataPoint represents a single data point in SLA trend
type SLATrendDataPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Value     float64   `json:"value"`
}

// ErrorAnalysis analyzes errors in traces
type ErrorAnalysis struct {
	ErrorSummary      ErrorSummary        `json:"error_summary"`
	ErrorPatterns     []ErrorPattern      `json:"error_patterns"`
	ErrorDistribution map[string]int      `json:"error_distribution"`
	RootCauseAnalysis []RootCauseAnalysis `json:"root_cause_analysis"`
	ImpactAnalysis    ErrorImpactAnalysis `json:"impact_analysis"`
}

// ErrorSummary provides a summary of errors
type ErrorSummary struct {
	TotalErrors     int                   `json:"total_errors"`
	UniqueErrors    int                   `json:"unique_errors"`
	ErrorRate       float64               `json:"error_rate"`
	MostCommonError string                `json:"most_common_error"`
	ErrorTrend      string                `json:"error_trend"`
	ByService       map[string]ErrorStats `json:"by_service"`
	ByOperation     map[string]ErrorStats `json:"by_operation"`
}

// ErrorStats represents error statistics
type ErrorStats struct {
	Count          int       `json:"count"`
	Rate           float64   `json:"rate"`
	LastError      time.Time `json:"last_error"`
	AffectedTraces []string  `json:"affected_traces"`
}

// ErrorPattern represents a recurring error pattern
type ErrorPattern struct {
	Pattern    string                 `json:"pattern"`
	Count      int                    `json:"count"`
	Services   []string               `json:"services"`
	Operations []string               `json:"operations"`
	FirstSeen  time.Time              `json:"first_seen"`
	LastSeen   time.Time              `json:"last_seen"`
	Context    map[string]interface{} `json:"context"`
}

// RootCauseAnalysis represents root cause analysis for errors
type RootCauseAnalysis struct {
	ErrorType           string   `json:"error_type"`
	RootCause           string   `json:"root_cause"`
	ContributingFactors []string `json:"contributing_factors"`
	AffectedServices    []string `json:"affected_services"`
	Recommendation      string   `json:"recommendation"`
	Confidence          float64  `json:"confidence"`
}

// ErrorImpactAnalysis analyzes the impact of errors
type ErrorImpactAnalysis struct {
	UserImpact     UserImpact           `json:"user_impact"`
	BusinessImpact BusinessImpact       `json:"business_impact"`
	SystemImpact   SystemImpact         `json:"system_impact"`
	Mitigation     []MitigationStrategy `json:"mitigation"`
}

// UserImpact represents the impact on users
type UserImpact struct {
	AffectedUsers  int           `json:"affected_users"`
	ImpactDuration time.Duration `json:"impact_duration"`
	ImpactSeverity string        `json:"impact_severity"`
	UserComplaints int           `json:"user_complaints"`
}

// BusinessImpact represents the business impact
type BusinessImpact struct {
	RevenueLoss     float64 `json:"revenue_loss"`
	TransactionLoss int     `json:"transaction_loss"`
	CustomerImpact  float64 `json:"customer_impact"`
	BrandReputation float64 `json:"brand_reputation"`
}

// SystemImpact represents the system impact
type SystemImpact struct {
	PerformanceDegradation float64  `json:"performance_degradation"`
	ResourceUtilization    float64  `json:"resource_utilization"`
	CascadingFailures      []string `json:"cascading_failures"`
	SystemStability        float64  `json:"system_stability"`
}

// MitigationStrategy represents a mitigation strategy
type MitigationStrategy struct {
	Strategy           string  `json:"strategy"`
	Description        string  `json:"description"`
	Priority           string  `json:"priority"`
	EstimatedEffort    string  `json:"estimated_effort"`
	SuccessProbability float64 `json:"success_probability"`
}

// Anomaly represents an anomaly detected in trace data
type Anomaly struct {
	ID              string                 `json:"id"`
	Type            string                 `json:"type"`
	Severity        string                 `json:"severity"`
	Description     string                 `json:"description"`
	TraceID         string                 `json:"trace_id"`
	SpanID          string                 `json:"span_id"`
	DetectionTime   time.Time              `json:"detection_time"`
	Context         map[string]interface{} `json:"context"`
	Recommendations []string               `json:"recommendations"`
}

// TraceMetrics contains metrics for a trace
type TraceMetrics struct {
	LatencyMetrics    LatencyMetrics         `json:"latency_metrics"`
	ThroughputMetrics ThroughputMetrics      `json:"throughput_metrics"`
	ErrorMetrics      ErrorMetrics           `json:"error_metrics"`
	ResourceMetrics   ResourceMetrics        `json:"resource_metrics"`
	CustomMetrics     map[string]interface{} `json:"custom_metrics"`
}

// LatencyMetrics contains latency-related metrics
type LatencyMetrics struct {
	Min    time.Duration `json:"min"`
	Max    time.Duration `json:"max"`
	Mean   time.Duration `json:"mean"`
	Median time.Duration `json:"median"`
	P50    time.Duration `json:"p50"`
	P75    time.Duration `json:"p75"`
	P90    time.Duration `json:"p90"`
	P95    time.Duration `json:"p95"`
	P99    time.Duration `json:"p99"`
	P999   time.Duration `json:"p999"`
	StdDev time.Duration `json:"std_dev"`
}

// ErrorMetrics contains error-related metrics
type ErrorMetrics struct {
	TotalCount   int            `json:"total_count"`
	UniqueErrors int            `json:"unique_errors"`
	ErrorRate    float64        `json:"error_rate"`
	LastError    time.Time      `json:"last_error"`
	ErrorTypes   map[string]int `json:"error_types"`
	ErrorTrend   string         `json:"error_trend"`
}

// NewTraceAnalytics creates a new trace analytics instance
func NewTraceAnalytics(tracingService *TracingService, maxSize int, maxAge time.Duration) *TraceAnalytics {
	logger := log.New(log.Writer(), "[TRACE-ANALYTICS] ", log.LstdFlags|log.Lmsgprefix)

	return &TraceAnalytics{
		tracingService: tracingService,
		traceStore:     NewTraceStore(maxSize, maxAge),
		analysisCache:  make(map[string]*AnalysisResult),
		logger:         logger,
	}
}

// NewTraceStore creates a new trace store
func NewTraceStore(maxSize int, maxAge time.Duration) *TraceStore {
	return &TraceStore{
		traces: make(map[string]*StoredTrace),
		indexes: &TraceIndexes{
			ByService:   make(map[string][]string),
			ByOperation: make(map[string][]string),
			ByStatus:    make(map[string][]string),
			ByTimeRange: make(map[time.Time][]string),
			ByDuration:  make(map[DurationRange][]string),
			ByError:     make(map[string][]string),
			ByTag:       make(map[string]map[string][]string),
			SlowTraces:  make([]string, 0),
			ErrorTraces: make([]string, 0),
		},
		maxSize: maxSize,
		maxAge:  maxAge,
	}
}

// AnalyzeTrace performs comprehensive analysis of a trace
func (ta *TraceAnalytics) AnalyzeTrace(ctx context.Context, traceID string) (*AnalysisResult, error) {
	// Check cache first
	ta.mu.RLock()
	if result, exists := ta.analysisCache[traceID]; exists {
		ta.mu.RUnlock()
		return result, nil
	}
	ta.mu.RUnlock()

	// Retrieve trace data
	trace, err := ta.traceStore.GetTrace(traceID)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve trace %s: %w", traceID, err)
	}

	// Perform analysis
	result := &AnalysisResult{
		TraceID:      traceID,
		AnalysisType: "comprehensive",
		GeneratedAt:  time.Now(),
		Insights:     make(map[string]interface{}),
	}

	// Generate summary
	result.Summary = ta.generateSummary(trace)

	// Analyze performance
	result.Performance = ta.analyzePerformance(trace)

	// Analyze dependencies
	result.Dependencies = ta.analyzeDependencies(trace)

	// Analyze errors
	result.Errors = ta.analyzeErrors(trace)

	// Detect anomalies
	result.Anomalies = ta.detectAnomalies(trace)

	// Generate recommendations
	result.Recommendations = ta.generateRecommendations(result)

	// Cache result
	ta.mu.Lock()
	ta.analysisCache[traceID] = result
	ta.mu.Unlock()

	ta.logger.Printf("Completed trace analysis for %s: %d spans, %d anomalies, %d recommendations",
		traceID, trace.SpanCount, len(result.Anomalies), len(result.Recommendations))

	return result, nil
}

// generateSummary generates a summary of the trace
func (ta *TraceAnalytics) generateSummary(trace *StoredTrace) TraceSummary {
	// Calculate latencies
	latencies := ta.calculateLatencies(trace)

	return TraceSummary{
		TotalSpans:       trace.SpanCount,
		TotalDuration:    trace.Duration,
		ServicesInvolved: ta.getServicesInvolved(trace),
		OperationPath:    ta.getOperationPath(trace),
		CriticalPath:     ta.calculateCriticalPath(trace),
		ErrorCount:       trace.ErrorCount,
		SuccessRate:      ta.calculateSuccessRate(trace),
		AverageLatency:   latencies.Mean,
		P95Latency:       latencies.P95,
		P99Latency:       latencies.P99,
	}
}

// analyzePerformance analyzes performance aspects of the trace
func (ta *TraceAnalytics) analyzePerformance(trace *StoredTrace) PerformanceAnalysis {
	// Find slowest spans
	slowestSpans := ta.findSlowestSpans(trace)

	// Identify bottlenecks
	bottlenecks := ta.identifyBottlenecks(trace, slowestSpans)

	// Calculate critical path
	criticalPath := ta.calculateCriticalPathPath(trace)

	return PerformanceAnalysis{
		SlowestSpans:  slowestSpans,
		CriticalPath:  criticalPath,
		Bottlenecks:   bottlenecks,
		ResourceUsage: ta.calculateResourceUsage(trace),
		Throughput:    ta.calculateThroughput(trace),
		Concurrency:   ta.calculateConcurrency(trace),
	}
}

// analyzeDependencies analyzes service dependencies in the trace
func (ta *TraceAnalytics) analyzeDependencies(trace *StoredTrace) DependencyAnalysis {
	// Build service dependency map
	serviceMap := ta.buildServiceDependencyMap(trace)

	// Create call graph
	callGraph := ta.createCallGraph(trace)

	// Build dependency tree
	dependencyTree := ta.buildDependencyTree(trace)

	// Analyze SLA compliance
	slaCompliance := ta.analyzeSLACompliance(trace)

	return DependencyAnalysis{
		ServiceMap:     serviceMap,
		CallGraph:      callGraph,
		DependencyTree: dependencyTree,
		CriticalPath:   ta.getDependencyCriticalPath(trace),
		SLACompliance:  slaCompliance,
	}
}

// analyzeErrors analyzes errors in the trace
func (ta *TraceAnalytics) analyzeErrors(trace *StoredTrace) ErrorAnalysis {
	// Generate error summary
	errorSummary := ta.generateErrorSummary(trace)

	// Identify error patterns
	errorPatterns := ta.identifyErrorPatterns(trace)

	// Perform root cause analysis
	rootCauseAnalysis := ta.performRootCauseAnalysis(trace, errorPatterns)

	// Analyze impact
	impactAnalysis := ta.analyzeErrorImpact(trace, errorSummary)

	return ErrorAnalysis{
		ErrorSummary:      errorSummary,
		ErrorPatterns:     errorPatterns,
		ErrorDistribution: ta.getErrorDistribution(trace),
		RootCauseAnalysis: rootCauseAnalysis,
		ImpactAnalysis:    impactAnalysis,
	}
}

// detectAnomalies detects anomalies in the trace
func (ta *TraceAnalytics) detectAnomalies(trace *StoredTrace) []Anomaly {
	anomalies := make([]Anomaly, 0)

	// Detect performance anomalies
	anomalies = append(anomalies, ta.detectPerformanceAnomalies(trace)...)

	// Detect error anomalies
	anomalies = append(anomalies, ta.detectErrorAnomalies(trace)...)

	// Detect dependency anomalies
	anomalies = append(anomalies, ta.detectDependencyAnomalies(trace)...)

	// Detect resource anomalies
	anomalies = append(anomalies, ta.detectResourceAnomalies(trace)...)

	return anomalies
}

// generateRecommendations generates recommendations based on analysis
func (ta *TraceAnalytics) generateRecommendations(result *AnalysisResult) []string {
	recommendations := make([]string, 0)

	// Performance recommendations
	if len(result.Performance.Bottlenecks) > 0 {
		recommendations = append(recommendations, "Address performance bottlenecks in critical path")
	}

	// Error recommendations
	if result.Errors.ErrorSummary.ErrorRate > 0.05 {
		recommendations = append(recommendations, "Investigate and fix high error rate")
	}

	// Dependency recommendations
	if len(result.Dependencies.SLACompliance.Violations) > 0 {
		recommendations = append(recommendations, "Review and improve SLA compliance")
	}

	// Anomaly recommendations
	for _, anomaly := range result.Anomalies {
		if anomaly.Severity == "high" || anomaly.Severity == "critical" {
			recommendations = append(recommendations, fmt.Sprintf("Investigate %s anomaly: %s", anomaly.Type, anomaly.Description))
		}
	}

	return recommendations
}

// Helper methods for analysis
func (ta *TraceAnalytics) calculateLatencies(trace *StoredTrace) LatencyMetrics {
	durations := make([]time.Duration, 0)
	ta.collectSpanDurations(trace.SpanTree, &durations)

	if len(durations) == 0 {
		return LatencyMetrics{}
	}

	sort.Slice(durations, func(i, j int) bool {
		return durations[i] < durations[j]
	})

	return LatencyMetrics{
		Min:    durations[0],
		Max:    durations[len(durations)-1],
		Mean:   ta.calculateMean(durations),
		Median: ta.calculateMedian(durations),
		P50:    ta.calculatePercentile(durations, 0.50),
		P75:    ta.calculatePercentile(durations, 0.75),
		P90:    ta.calculatePercentile(durations, 0.90),
		P95:    ta.calculatePercentile(durations, 0.95),
		P99:    ta.calculatePercentile(durations, 0.99),
		P999:   ta.calculatePercentile(durations, 0.999),
		StdDev: ta.calculateStdDev(durations),
	}
}

func (ta *TraceAnalytics) collectSpanDurations(node *SpanNode, durations *[]time.Duration) {
	if node == nil {
		return
	}

	*durations = append(*durations, node.SpanInfo.Duration)

	for _, child := range node.Children {
		ta.collectSpanDurations(child, durations)
	}
}

func (ta *TraceAnalytics) calculateMean(durations []time.Duration) time.Duration {
	if len(durations) == 0 {
		return 0
	}

	var total time.Duration
	for _, d := range durations {
		total += d
	}

	return total / time.Duration(len(durations))
}

func (ta *TraceAnalytics) calculateMedian(durations []time.Duration) time.Duration {
	if len(durations) == 0 {
		return 0
	}

	mid := len(durations) / 2
	if len(durations)%2 == 1 {
		return durations[mid]
	}

	return (durations[mid-1] + durations[mid]) / 2
}

func (ta *TraceAnalytics) calculatePercentile(durations []time.Duration, percentile float64) time.Duration {
	if len(durations) == 0 {
		return 0
	}

	index := int(float64(len(durations)) * percentile)
	if index >= len(durations) {
		index = len(durations) - 1
	}

	return durations[index]
}

func (ta *TraceAnalytics) calculateStdDev(durations []time.Duration) time.Duration {
	if len(durations) == 0 {
		return 0
	}

	mean := ta.calculateMean(durations)
	var variance float64

	for _, d := range durations {
		diff := float64(d - mean)
		variance += diff * diff
	}

	variance /= float64(len(durations))
	stdDev := math.Sqrt(variance)

	return time.Duration(stdDev)
}

// TraceStore methods
func (ts *TraceStore) GetTrace(traceID string) (*StoredTrace, error) {
	ts.mu.RLock()
	defer ts.mu.RUnlock()

	trace, exists := ts.traces[traceID]
	if !exists {
		return nil, fmt.Errorf("trace %s not found", traceID)
	}

	return trace, nil
}

func (ts *TraceStore) StoreTrace(trace *StoredTrace) error {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	// Check if we need to make space
	if len(ts.traces) >= ts.maxSize {
		ts.evictOldestTrace()
	}

	// Store trace
	ts.traces[trace.TraceID] = trace

	// Update indexes
	ts.updateIndexes(trace)

	return nil
}

func (ts *TraceStore) evictOldestTrace() {
	var oldestTraceID string
	var oldestTime time.Time

	for traceID, trace := range ts.traces {
		if oldestTime.IsZero() || trace.StartTime.Before(oldestTime) {
			oldestTime = trace.StartTime
			oldestTraceID = traceID
		}
	}

	if oldestTraceID != "" {
		delete(ts.traces, oldestTraceID)
	}
}

func (ts *TraceStore) updateIndexes(trace *StoredTrace) {
	// Update service index
	ts.indexes.ByService[trace.ServiceName] = append(ts.indexes.ByService[trace.ServiceName], trace.TraceID)

	// Update operation index
	ts.indexes.ByOperation[trace.Operation] = append(ts.indexes.ByOperation[trace.Operation], trace.TraceID)

	// Update status index
	ts.indexes.ByStatus[trace.Status] = append(ts.indexes.ByStatus[trace.Status], trace.TraceID)

	// Update time range index
	timeKey := trace.StartTime.Truncate(time.Hour)
	ts.indexes.ByTimeRange[timeKey] = append(ts.indexes.ByTimeRange[timeKey], trace.TraceID)

	// Update duration index
	durationRange := ts.getDurationRange(trace.Duration)
	ts.indexes.ByDuration[durationRange] = append(ts.indexes.ByDuration[durationRange], trace.TraceID)

	// Update error traces
	if trace.ErrorCount > 0 {
		ts.indexes.ErrorTraces = append(ts.indexes.ErrorTraces, trace.TraceID)
	}

	// Update slow traces
	if trace.Duration > 5*time.Second {
		ts.indexes.SlowTraces = append(ts.indexes.SlowTraces, trace.TraceID)
	}

	ts.indexes.LastUpdated = time.Now()
}

func (ts *TraceStore) getDurationRange(duration time.Duration) DurationRange {
	// Define duration ranges
	ranges := []DurationRange{
		{Min: 0, Max: 100 * time.Millisecond},
		{Min: 100 * time.Millisecond, Max: 500 * time.Millisecond},
		{Min: 500 * time.Millisecond, Max: 1 * time.Second},
		{Min: 1 * time.Second, Max: 5 * time.Second},
		{Min: 5 * time.Second, Max: math.MaxInt64},
	}

	for _, r := range ranges {
		if duration >= r.Min && duration < r.Max {
			return r
		}
	}

	return DurationRange{Min: 5 * time.Second, Max: math.MaxInt64}
}

// Placeholder implementations for complex analysis functions
func (ta *TraceAnalytics) getServicesInvolved(trace *StoredTrace) []string {
	// Implementation would extract unique service names from span tree
	return []string{trace.ServiceName}
}

func (ta *TraceAnalytics) getOperationPath(trace *StoredTrace) []string {
	// Implementation would extract operation path from span tree
	return []string{trace.Operation}
}

func (ta *TraceAnalytics) calculateCriticalPath(trace *StoredTrace) time.Duration {
	// Implementation would calculate critical path through span tree
	return trace.Duration
}

func (ta *TraceAnalytics) calculateSuccessRate(trace *StoredTrace) float64 {
	if trace.SpanCount == 0 {
		return 1.0
	}
	return float64(trace.SpanCount-trace.ErrorCount) / float64(trace.SpanCount)
}

func (ta *TraceAnalytics) findSlowestSpans(trace *StoredTrace) []SpanLatency {
	// Implementation would find slowest spans in the trace
	return []SpanLatency{}
}

func (ta *TraceAnalytics) identifyBottlenecks(trace *StoredTrace, slowSpans []SpanLatency) []Bottleneck {
	// Implementation would identify performance bottlenecks
	return []Bottleneck{}
}

func (ta *TraceAnalytics) calculateCriticalPathPath(trace *StoredTrace) []string {
	// Implementation would calculate critical path
	return []string{}
}

func (ta *TraceAnalytics) calculateResourceUsage(trace *StoredTrace) ResourceMetrics {
	// Implementation would calculate resource usage metrics
	return ResourceMetrics{}
}

func (ta *TraceAnalytics) calculateThroughput(trace *StoredTrace) ThroughputMetrics {
	// Implementation would calculate throughput metrics
	return ThroughputMetrics{}
}

func (ta *TraceAnalytics) calculateConcurrency(trace *StoredTrace) ConcurrencyMetrics {
	// Implementation would calculate concurrency metrics
	return ConcurrencyMetrics{}
}

func (ta *TraceAnalytics) buildServiceDependencyMap(trace *StoredTrace) ServiceDependencyMap {
	// Implementation would build service dependency map
	return ServiceDependencyMap{}
}

func (ta *TraceAnalytics) createCallGraph(trace *StoredTrace) CallGraph {
	// Implementation would create call graph
	return CallGraph{}
}

func (ta *TraceAnalytics) buildDependencyTree(trace *StoredTrace) DependencyTree {
	// Implementation would build dependency tree
	return DependencyTree{}
}

func (ta *TraceAnalytics) analyzeSLACompliance(trace *StoredTrace) SLAAnalysis {
	// Implementation would analyze SLA compliance
	return SLAAnalysis{}
}

func (ta *TraceAnalytics) getDependencyCriticalPath(trace *StoredTrace) []string {
	// Implementation would get dependency critical path
	return []string{}
}

func (ta *TraceAnalytics) generateErrorSummary(trace *StoredTrace) ErrorSummary {
	// Implementation would generate error summary
	return ErrorSummary{}
}

func (ta *TraceAnalytics) identifyErrorPatterns(trace *StoredTrace) []ErrorPattern {
	// Implementation would identify error patterns
	return []ErrorPattern{}
}

func (ta *TraceAnalytics) performRootCauseAnalysis(trace *StoredTrace, patterns []ErrorPattern) []RootCauseAnalysis {
	// Implementation would perform root cause analysis
	return []RootCauseAnalysis{}
}

func (ta *TraceAnalytics) analyzeErrorImpact(trace *StoredTrace, summary ErrorSummary) ErrorImpactAnalysis {
	// Implementation would analyze error impact
	return ErrorImpactAnalysis{}
}

func (ta *TraceAnalytics) getErrorDistribution(trace *StoredTrace) map[string]int {
	// Implementation would get error distribution
	return make(map[string]int)
}

func (ta *TraceAnalytics) detectPerformanceAnomalies(trace *StoredTrace) []Anomaly {
	// Implementation would detect performance anomalies
	return []Anomaly{}
}

func (ta *TraceAnalytics) detectErrorAnomalies(trace *StoredTrace) []Anomaly {
	// Implementation would detect error anomalies
	return []Anomaly{}
}

func (ta *TraceAnalytics) detectDependencyAnomalies(trace *StoredTrace) []Anomaly {
	// Implementation would detect dependency anomalies
	return []Anomaly{}
}

func (ta *TraceAnalytics) detectResourceAnomalies(trace *StoredTrace) []Anomaly {
	// Implementation would detect resource anomalies
	return []Anomaly{}
}
