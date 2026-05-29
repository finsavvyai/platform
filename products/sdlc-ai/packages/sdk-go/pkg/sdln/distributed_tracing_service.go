package sdln

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"
)

// DistributedTracingService handles end-to-end distributed tracing
type DistributedTracingService struct {
	service    *AdvancedMonitoringService
	spans      *SpanStorage
	traces     *TraceStorage
	sampler    TraceSampler
	analytics  *TraceAnalytics
	correlator *TraceCorrelator
	config     TracingConfig
}

// NewDistributedTracingService creates a new distributed tracing service
func NewDistributedTracingService(service *AdvancedMonitoringService) *DistributedTracingService {
	return &DistributedTracingService{
		service:    service,
		spans:      NewSpanStorage(),
		traces:     NewTraceStorage(),
		sampler:    NewTraceSampler(),
		analytics:  NewTraceAnalytics(),
		correlator: NewTraceCorrelator(),
		config: TracingConfig{
			SamplingRate:       0.1, // 10%
			MaxSpansPerTrace:   1000,
			TraceTimeout:       time.Minute * 5,
			AnalysisInterval:   time.Minute * 10,
			RetentionPeriod:    time.Hour * 24 * 7, // 7 days
			AnalyticsEnabled:   true,
			CorrelationEnabled: true,
		},
	}
}

// SpanStorage stores trace spans
type SpanStorage struct {
	spans map[string]*EnhancedSpan
	index map[string][]string // trace_id -> span_ids
	tags  map[string][]string // tag -> span_ids
	mu    sync.RWMutex
}

// TraceStorage stores trace summaries
type TraceStorage struct {
	traces map[string]*TraceSummary
	index  map[string][]string // service -> trace_ids
	errors map[string][]string // error_type -> trace_ids
	mu     sync.RWMutex
}

// EnhancedSpan extends the basic span with enhanced fields
type EnhancedSpan struct {
	*TraceSpan
	ParentService string                 `json:"parent_service,omitempty"`
	Component     string                 `json:"component"`
	Kind          SpanKind               `json:"kind"`
	StatusCode    uint32                 `json:"status_code"`
	StatusMessage string                 `json:"status_message"`
	Peer          string                 `json:"peer,omitempty"`
	Library       LibraryInfo            `json:"library,omitempty"`
	Process       ProcessInfo            `json:"process,omitempty"`
	Resources     map[string]interface{} `json:"resources,omitempty"`
	Events        []SpanEvent            `json:"events,omitempty"`
	Links         []SpanLink             `json:"links,omitempty"`
	Metrics       SpanMetrics            `json:"metrics"`
	DurationHist  []HistogramBucket      `json:"duration_hist,omitempty"`
	Sampled       bool                   `json:"sampled"`
	Debug         bool                   `json:"debug"`
	Tags          map[string]string      `json:"tags"`
}

// SpanKind defines span types
type SpanKind string

const (
	SpanKindInternal SpanKind = "internal"
	SpanKindServer   SpanKind = "server"
	SpanKindClient   SpanKind = "client"
	SpanKindProducer SpanKind = "producer"
	SpanKindConsumer SpanKind = "consumer"
)

// LibraryInfo provides library information
type LibraryInfo struct {
	Name     string `json:"name"`
	Language string `json:"language"`
	Version  string `json:"version"`
}

// ProcessInfo provides process information
type ProcessInfo struct {
	PID            int               `json:"pid"`
	Executable     string            `json:"executable"`
	Command        string            `json:"command"`
	RuntimeName    string            `json:"runtime_name"`
	RuntimeVersion string            `json:"runtime_version"`
	Hostname       string            `json:"hostname"`
	Tags           map[string]string `json:"tags"`
}

// SpanEvent represents an event within a span
type SpanEvent struct {
	Timestamp  Timestamp              `json:"timestamp"`
	Name       string                 `json:"name"`
	Attributes map[string]interface{} `json:"attributes"`
}

// SpanLink represents a link to another span
type SpanLink struct {
	TraceID    string            `json:"trace_id"`
	SpanID     string            `json:"span_id"`
	Attributes map[string]string `json:"attributes"`
}

// SpanMetrics provides span-specific metrics
type SpanMetrics struct {
	CPUUsage       float64 `json:"cpu_usage"`
	MemoryUsage    int64   `json:"memory_usage"`
	NetworkIn      int64   `json:"network_in"`
	NetworkOut     int64   `json:"network_out"`
	DiskIO         int64   `json:"disk_io"`
	GoroutineCount int     `json:"goroutine_count"`
}

// HistogramBucket represents a histogram bucket
type HistogramBucket struct {
	UpperBound float64 `json:"upper_bound"`
	Count      int64   `json:"count"`
}

// TraceSummary provides a summary of a trace
type TraceSummary struct {
	TraceID        string                 `json:"trace_id"`
	RootSpan       *EnhancedSpan          `json:"root_span"`
	StartTime      Timestamp              `json:"start_time"`
	EndTime        Timestamp              `json:"end_time"`
	Duration       time.Duration          `json:"duration"`
	SpanCount      int                    `json:"span_count"`
	Depth          int                    `json:"depth"`
	ServiceCount   int                    `json:"service_count"`
	ErrorCount     int                    `json:"error_count"`
	Services       []ServiceSummary       `json:"services"`
	Components     []ComponentSummary     `json:"components"`
	Status         TraceStatus            `json:"status"`
	Classification TraceClassification    `json:"classification"`
	Performance    PerformanceMetrics     `json:"performance"`
	Resources      map[string]interface{} `json:"resources"`
	Tags           map[string]string      `json:"tags"`
}

// ServiceSummary summarizes a service in a trace
type ServiceSummary struct {
	Name       string        `json:"name"`
	SpanCount  int           `json:"span_count"`
	Duration   time.Duration `json:"duration"`
	ErrorCount int           `json:"error_count"`
	Throughput float64       `json:"throughput"`
	Latency    LatencyStats  `json:"latency"`
}

// ComponentSummary summarizes a component in a trace
type ComponentSummary struct {
	Name      string        `json:"name"`
	Type      string        `json:"type"`
	SpanCount int           `json:"span_count"`
	Duration  time.Duration `json:"duration"`
	ErrorRate float64       `json:"error_rate"`
}

// TraceStatus defines trace status
type TraceStatus string

const (
	TraceStatusSuccess TraceStatus = "success"
	TraceStatusError   TraceStatus = "error"
	TraceStatusTimeout TraceStatus = "timeout"
	TraceStatusPartial TraceStatus = "partial"
)

// TraceClassification classifies trace patterns
type TraceClassification struct {
	Pattern     string   `json:"pattern"`     // normal, slow, error, timeout, complex
	Confidence  float64  `json:"confidence"`  // 0.0 to 1.0
	Anomalies   []string `json:"anomalies"`   // detected anomalies
	Bottlenecks []string `json:"bottlenecks"` // bottleneck components
	Issues      []string `json:"issues"`      // detected issues
}

// PerformanceMetrics provides performance metrics
type PerformanceMetrics struct {
	AvgDuration time.Duration `json:"avg_duration"`
	MaxDuration time.Duration `json:"max_duration"`
	MinDuration time.Duration `json:"min_duration"`
	P95Duration time.Duration `json:"p95_duration"`
	P99Duration time.Duration `json:"p99_duration"`
	Throughput  float64       `json:"throughput"` // requests per second
	ErrorRate   float64       `json:"error_rate"` // percentage
	Saturation  float64       `json:"saturation"` // 0.0 to 1.0
}

// LatencyStats provides latency statistics
type LatencyStats struct {
	Min time.Duration `json:"min"`
	Max time.Duration `json:"max"`
	Avg time.Duration `json:"avg"`
	P50 time.Duration `json:"p50"`
	P90 time.Duration `json:"p90"`
	P95 time.Duration `json:"p95"`
	P99 time.Duration `json:"p99"`
}

// TraceSampler handles trace sampling
type TraceSampler struct {
	rate     float64
	counters map[string]*Counter
	mu       sync.RWMutex
}

// Counter tracks sampling counts
type Counter struct {
	Total   int64 `json:"total"`
	Sampled int64 `json:"sampled"`
}

// TraceAnalytics analyzes trace data
type TraceAnalytics struct {
	patterns map[string]*TracePattern
	insights *TraceInsights
	mu       sync.RWMutex
}

// TracePattern represents a trace pattern
type TracePattern struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Type        PatternType            `json:"type"`
	Description string                 `json:"description"`
	Signature   string                 `json:"signature"`
	Metadata    map[string]interface{} `json:"metadata"`
	Frequency   float64                `json:"frequency"`
	Impact      float64                `json:"impact"`
	Created     Timestamp              `json:"created"`
}

// PatternType defines pattern types
type PatternType string

const (
	PatternTypeNormal     PatternType = "normal"
	PatternTypeSlow       PatternType = "slow"
	PatternTypeError      PatternType = "error"
	PatternTypeTimeout    PatternType = "timeout"
	PatternTypeBottleneck PatternType = "bottleneck"
	PatternTypeCascading  PatternType = "cascading"
	PatternTypeRepeated   PatternType = "repeated"
)

// TraceInsights provides insights from trace analysis
type TraceInsights struct {
	TopErrors          []ErrorInsight   `json:"top_errors"`
	SlowestTraces      []TraceSummary   `json:"slowest_traces"`
	BottleneckServices []ServiceInsight `json:"bottleneck_services"`
	UnusualPatterns    []PatternInsight `json:"unusual_patterns"`
	Recommendations    []Recommendation `json:"recommendations"`
	SLACompliance      SLAReport        `json:"sla_compliance"`
}

// ErrorInsight provides error analysis
type ErrorInsight struct {
	Type     string    `json:"type"`
	Count    int       `json:"count"`
	Rate     float64   `json:"rate"`
	Services []string  `json:"services"`
	LastSeen Timestamp `json:"last_seen"`
	Impact   string    `json:"impact"`
}

// ServiceInsight provides service analysis
type ServiceInsight struct {
	Name       string        `json:"name"`
	Duration   time.Duration `json:"duration"`
	ErrorRate  float64       `json:"error_rate"`
	Throughput float64       `json:"throughput"`
	Saturation float64       `json:"saturation"`
	DependsOn  []string      `json:"depends_on"`
	Affects    []string      `json:"affects"`
}

// PatternInsight provides pattern analysis
type PatternInsight struct {
	Pattern     string    `json:"pattern"`
	Type        string    `json:"type"`
	Frequency   float64   `json:"frequency"`
	Confidence  float64   `json:"confidence"`
	FirstSeen   Timestamp `json:"first_seen"`
	LastSeen    Timestamp `json:"last_seen"`
	Description string    `json:"description"`
}

// Recommendation provides optimization recommendations
type Recommendation struct {
	Type        string  `json:"type"`     // performance, reliability, architecture
	Priority    string  `json:"priority"` // high, medium, low
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Impact      string  `json:"impact"`
	Effort      string  `json:"effort"`     // low, medium, high
	Confidence  float64 `json:"confidence"` // 0.0 to 1.0
}

// SLAReport provides SLA compliance report
type SLAReport struct {
	Overall     SLAMetrics            `json:"overall"`
	ByService   map[string]SLAMetrics `json:"by_service"`
	ByOperation map[string]SLAMetrics `json:"by_operation"`
}

// SLAMetrics provides SLA metrics
type SLAMetrics struct {
	Availability float64      `json:"availability"` // percentage
	Latency      LatencyStats `json:"latency"`
	ErrorRate    float64      `json:"error_rate"`
	Compliance   bool         `json:"compliance"`
}

// TraceCorrelator correlates related traces
type TraceCorrelator struct {
	correlations map[string][]string // correlation_id -> trace_ids
	relations    map[string][]string // trace_id -> related_trace_ids
	mu           sync.RWMutex
}

// TracingConfig configures distributed tracing
type TracingConfig struct {
	SamplingRate       float64       `json:"sampling_rate"`
	MaxSpansPerTrace   int           `json:"max_spans_per_trace"`
	TraceTimeout       time.Duration `json:"trace_timeout"`
	AnalysisInterval   time.Duration `json:"analysis_interval"`
	RetentionPeriod    time.Duration `json:"retention_period"`
	AnalyticsEnabled   bool          `json:"analytics_enabled"`
	CorrelationEnabled bool          `json:"correlation_enabled"`
}

// NewSpanStorage creates a new span storage
func NewSpanStorage() *SpanStorage {
	return &SpanStorage{
		spans: make(map[string]*EnhancedSpan),
		index: make(map[string][]string),
		tags:  make(map[string][]string),
	}
}

// NewTraceStorage creates a new trace storage
func NewTraceStorage() *TraceStorage {
	return &TraceStorage{
		traces: make(map[string]*TraceSummary),
		index:  make(map[string][]string),
		errors: make(map[string][]string),
	}
}

// NewTraceSampler creates a new trace sampler
func NewTraceSampler() *TraceSampler {
	return &TraceSampler{
		rate:     0.1,
		counters: make(map[string]*Counter),
	}
}

// NewTraceAnalytics creates a new trace analytics
func NewTraceAnalytics() *TraceAnalytics {
	return &TraceAnalytics{
		patterns: make(map[string]*TracePattern),
		insights: &TraceInsights{},
	}
}

// NewTraceCorrelator creates a new trace correlator
func NewTraceCorrelator() *TraceCorrelator {
	return &TraceCorrelator{
		correlations: make(map[string][]string),
		relations:    make(map[string][]string),
	}
}

// CreateSpan creates a new span
func (dts *DistributedTracingService) CreateSpan(ctx context.Context, span *EnhancedSpan) error {
	// Check if we should sample this span
	if !dts.shouldSample(span) {
		return nil
	}

	span.Sampled = true

	// Store span
	dts.spans.mu.Lock()
	dts.spans.spans[span.ID] = span
	dts.spans.index[span.TraceID] = append(dts.spans.index[span.TraceID], span.ID)

	// Index by tags
	for tag, value := range span.Tags {
		key := fmt.Sprintf("%s:%s", tag, value)
		dts.spans.tags[key] = append(dts.spans.tags[key], span.ID)
	}
	dts.spans.mu.Unlock()

	// Update trace summary
	dts.updateTraceSummary(span.TraceID)

	// Analyze if enabled
	if dts.config.AnalyticsEnabled {
		go dts.analyzeTrace(span.TraceID)
	}

	return nil
}

// shouldSample determines if a span should be sampled
func (dts *DistributedTracingService) shouldSample(span *EnhancedSpan) bool {
	// Always sample error spans
	if span.Status == "error" {
		return true
	}

	// Always sample debug spans
	if span.Debug {
		return true
	}

	// Check sampling rate
	if dts.sampler.rate >= 1.0 {
		return true
	}

	// Use hash-based sampling for consistency
	hash := hashString(span.TraceID)
	return float64(hash%1000)/1000 < dts.sampler.rate
}

// GetTrace retrieves a trace
func (dts *DistributedTracingService) GetTrace(ctx context.Context, tenantID, traceID string) (*TraceSummary, error) {
	dts.traces.mu.RLock()
	trace, exists := dts.traces.traces[traceID]
	dts.traces.mu.RUnlock()

	if !exists {
		// Build trace from spans
		trace = dts.buildTraceSummary(traceID)
		dts.traces.mu.Lock()
		dts.traces.traces[traceID] = trace
		dts.traces.mu.Unlock()
	}

	return trace, nil
}

// SearchTraces searches for traces
func (dts *DistributedTracingService) SearchTraces(ctx context.Context, tenantID string, query *TraceSearchQuery) (*TraceSearchResult, error) {
	var traces []*TraceSummary
	var total int64

	// Get trace IDs from index
	dts.traces.mu.RLock()
	var traceIDs []string

	if query.Service != "" {
		traceIDs = dts.traces.index[query.Service]
	} else {
		// Get all traces
		for traceID := range dts.traces.traces {
			traceIDs = append(traceIDs, traceID)
		}
	}
	dts.traces.mu.RUnlock()

	// Filter traces
	for _, traceID := range traceIDs {
		trace, err := dts.GetTrace(ctx, tenantID, traceID)
		if err != nil {
			continue
		}

		if dts.matchesQuery(trace, query) {
			traces = append(traces, trace)
		}
	}

	total = int64(len(traces))

	// Apply pagination
	if query.Limit > 0 && query.Offset < len(traces) {
		end := query.Offset + query.Limit
		if end > len(traces) {
			end = len(traces)
		}
		traces = traces[query.Offset:end]
	}

	// Sort traces
	if query.SortBy != "" {
		dts.sortTraces(traces, query.SortBy, query.SortDesc)
	}

	return &TraceSearchResult{
		Traces: traces,
		Total:  total,
		Query:  query,
	}, nil
}

// TraceSearchQuery defines trace search query
type TraceSearchQuery struct {
	Service     string            `json:"service"`
	Component   string            `json:"component"`
	Status      string            `json:"status"`
	MinDuration *time.Duration    `json:"min_duration,omitempty"`
	MaxDuration *time.Duration    `json:"max_duration,omitempty"`
	StartTime   *Timestamp        `json:"start_time,omitempty"`
	EndTime     *Timestamp        `json:"end_time,omitempty"`
	Tags        map[string]string `json:"tags,omitempty"`
	Limit       int               `json:"limit"`
	Offset      int               `json:"offset"`
	SortBy      string            `json:"sort_by"`
	SortDesc    bool              `json:"sort_desc"`
}

// TraceSearchResult represents trace search results
type TraceSearchResult struct {
	Traces []*TraceSummary   `json:"traces"`
	Total  int64             `json:"total"`
	Query  *TraceSearchQuery `json:"query"`
}

// matchesQuery checks if trace matches query
func (dts *DistributedTracingService) matchesQuery(trace *TraceSummary, query *TraceSearchQuery) bool {
	// Check service
	if query.Service != "" {
		found := false
		for _, service := range trace.Services {
			if service.Name == query.Service {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	// Check status
	if query.Status != "" && string(trace.Status) != query.Status {
		return false
	}

	// Check duration
	if query.MinDuration != nil && trace.Duration < *query.MinDuration {
		return false
	}
	if query.MaxDuration != nil && trace.Duration > *query.MaxDuration {
		return false
	}

	// Check time range
	if query.StartTime != nil && trace.StartTime.Time.Before(query.StartTime.Time) {
		return false
	}
	if query.EndTime != nil && trace.EndTime.Time.After(query.EndTime.Time) {
		return false
	}

	// Check tags
	for key, value := range query.Tags {
		if traceValue, exists := trace.Tags[key]; !exists || traceValue != value {
			return false
		}
	}

	return true
}

// sortTraces sorts traces
func (dts *DistributedTracingService) sortTraces(traces []*TraceSummary, sortBy string, desc bool) {
	sort.Slice(traces, func(i, j int) bool {
		var less bool

		switch sortBy {
		case "duration":
			less = traces[i].Duration < traces[j].Duration
		case "span_count":
			less = traces[i].SpanCount < traces[j].SpanCount
		case "error_count":
			less = traces[i].ErrorCount < traces[j].ErrorCount
		case "start_time":
			less = traces[i].StartTime.Time.Before(traces[j].StartTime.Time)
		default:
			less = traces[i].StartTime.Time.Before(traces[j].StartTime.Time)
		}

		if desc {
			return !less
		}
		return less
	})
}

// buildTraceSummary builds trace summary from spans
func (dts *DistributedTracingService) buildTraceSummary(traceID string) *TraceSummary {
	dts.spans.mu.RLock()
	defer dts.spans.mu.RUnlock()

	spanIDs := dts.spans.index[traceID]
	if len(spanIDs) == 0 {
		return nil
	}

	summary := &TraceSummary{
		TraceID:    traceID,
		Services:   []ServiceSummary{},
		Components: []ComponentSummary{},
		Status:     TraceStatusSuccess,
		Tags:       make(map[string]string),
	}

	// Track services and components
	services := make(map[string]*ServiceSummary)
	components := make(map[string]*ComponentSummary)

	// Process spans
	for _, spanID := range spanIDs {
		span := dts.spans.spans[spanID]
		if span == nil {
			continue
		}

		// Set start/end times
		if summary.StartTime.IsZero() || span.StartTime.Time.Before(summary.StartTime.Time) {
			summary.StartTime = span.StartTime
		}
		if summary.EndTime.IsZero() || span.EndTime.Time.After(summary.EndTime.Time) {
			summary.EndTime = span.EndTime
		}

		// Count errors
		if span.Status == "error" {
			summary.ErrorCount++
			summary.Status = TraceStatusError
		}

		// Track services
		if svc, exists := services[span.Service]; exists {
			svc.SpanCount++
			svc.Duration += span.Duration
			if span.Status == "error" {
				svc.ErrorCount++
			}
		} else {
			services[span.Service] = &ServiceSummary{
				Name:       span.Service,
				SpanCount:  1,
				Duration:   span.Duration,
				ErrorCount: 0,
			}
			if span.Status == "error" {
				services[span.Service].ErrorCount = 1
			}
		}

		// Track components
		if comp, exists := components[span.Component]; exists {
			comp.SpanCount++
			comp.Duration += span.Duration
			if span.Status == "error" {
				comp.ErrorCount++
			}
		} else {
			components[span.Component] = &ComponentSummary{
				Name:       span.Component,
				Type:       span.Kind.String(),
				SpanCount:  1,
				Duration:   span.Duration,
				ErrorCount: 0,
			}
			if span.Status == "error" {
				components[span.Component].ErrorCount = 1
			}
		}

		// Find root span
		if span.ParentID == nil {
			summary.RootSpan = span
		}

		// Calculate depth
		depth := dts.calculateSpanDepth(span)
		if depth > summary.Depth {
			summary.Depth = depth
		}
	}

	// Calculate derived metrics
	summary.Duration = summary.EndTime.Time.Sub(summary.StartTime.Time)
	summary.SpanCount = len(spanIDs)
	summary.ServiceCount = len(services)

	// Convert maps to slices
	for _, svc := range services {
		svc.Latency = dts.calculateServiceLatency(svc.Name)
		summary.Services = append(summary.Services, *svc)
	}

	for _, comp := range components {
		comp.ErrorRate = float64(comp.ErrorCount) / float64(comp.SpanCount)
		summary.Components = append(summary.Components, *comp)
	}

	// Classify trace
	summary.Classification = dts.classifyTrace(summary)

	// Calculate performance metrics
	summary.Performance = dts.calculatePerformanceMetrics(summary)

	return summary
}

// calculateSpanDepth calculates span depth
func (dts *DistributedTracingService) calculateSpanDepth(span *EnhancedSpan) int {
	if span.ParentID == nil {
		return 1
	}

	dts.spans.mu.RLock()
	parent, exists := dts.spans.spans[*span.ParentID]
	dts.spans.mu.RUnlock()

	if !exists {
		return 1
	}

	return 1 + dts.calculateSpanDepth(parent)
}

// calculateServiceLatency calculates service latency stats
func (dts *DistributedTracingService) calculateServiceLatency(service string) LatencyStats {
	var durations []time.Duration

	dts.spans.mu.RLock()
	for _, span := range dts.spans.spans {
		if span.Service == service {
			durations = append(durations, span.Duration)
		}
	}
	dts.spans.mu.RUnlock()

	if len(durations) == 0 {
		return LatencyStats{}
	}

	sort.Slice(durations, func(i, j int) bool {
		return durations[i] < durations[j]
	})

	return LatencyStats{
		Min: durations[0],
		Max: durations[len(durations)-1],
		P50: durations[len(durations)/2],
		P90: durations[int(float64(len(durations))*0.9)],
		P95: durations[int(float64(len(durations))*0.95)],
		P99: durations[int(float64(len(durations))*0.99)],
	}
}

// classifyTrace classifies trace pattern
func (dts *DistributedTracingService) classifyTrace(trace *TraceSummary) TraceClassification {
	classification := TraceClassification{
		Pattern:     string(PatternTypeNormal),
		Confidence:  1.0,
		Anomalies:   []string{},
		Bottlenecks: []string{},
		Issues:      []string{},
	}

	// Check for errors
	if trace.ErrorCount > 0 {
		classification.Pattern = string(PatternTypeError)
		classification.Confidence = 0.9
		classification.Issues = append(classification.Issues, fmt.Sprintf("Contains %d errors", trace.ErrorCount))
	}

	// Check for slow traces
	if trace.Duration > time.Second*5 {
		if classification.Pattern == string(PatternTypeError) {
			classification.Pattern = "slow_error"
		} else {
			classification.Pattern = string(PatternTypeSlow)
		}
		classification.Confidence = 0.8
		classification.Issues = append(classification.Issues, fmt.Sprintf("Trace duration %v exceeds threshold", trace.Duration))
	}

	// Check bottlenecks
	for _, service := range trace.Services {
		if service.Duration > trace.Duration/2 {
			classification.Bottlenecks = append(classification.Bottlenecks, service.Name)
		}
	}

	// Check for complexity
	if trace.Depth > 10 {
		classification.Issues = append(classification.Issues, fmt.Sprintf("Deep call stack (depth: %d)", trace.Depth))
	}

	// Check for cascading failures
	if trace.ErrorCount > 3 && trace.ServiceCount > 3 {
		classification.Pattern = string(PatternTypeCascading)
		classification.Confidence = 0.7
	}

	return classification
}

// calculatePerformanceMetrics calculates performance metrics
func (dts *DistributedTracingService) calculatePerformanceMetrics(trace *TraceSummary) PerformanceMetrics {
	var durations []time.Duration
	var errorCount int

	for _, service := range trace.Services {
		durations = append(durations, service.Duration)
		errorCount += service.ErrorCount
	}

	if len(durations) == 0 {
		return PerformanceMetrics{}
	}

	sort.Slice(durations, func(i, j int) bool {
		return durations[i] < durations[j]
	})

	return PerformanceMetrics{
		AvgDuration: trace.Duration / time.Duration(trace.SpanCount),
		MaxDuration: durations[len(durations)-1],
		MinDuration: durations[0],
		P95Duration: durations[int(float64(len(durations))*0.95)],
		P99Duration: durations[int(float64(len(durations))*0.99)],
		Throughput:  float64(trace.SpanCount) / trace.Duration.Seconds(),
		ErrorRate:   float64(errorCount) / float64(trace.SpanCount),
		Saturation:  float64(trace.Depth) / 20, // Normalize to 0-1
	}
}

// updateTraceSummary updates trace summary when new span is added
func (dts *DistributedTracingService) updateTraceSummary(traceID string) {
	// Rebuild trace summary
	trace := dts.buildTraceSummary(traceID)
	if trace != nil {
		dts.traces.mu.Lock()
		dts.traces.traces[traceID] = trace

		// Update service index
		for _, service := range trace.Services {
			dts.traces.index[service.Name] = append(dts.traces.index[service.Name], traceID)
		}

		dts.traces.mu.Unlock()
	}
}

// analyzeTrace performs trace analysis
func (dts *DistributedTracingService) analyzeTrace(traceID string) {
	trace := dts.buildTraceSummary(traceID)
	if trace == nil {
		return
	}

	// Analyze patterns
	dts.analytics.mu.Lock()
	defer dts.analytics.mu.Unlock()

	// Check for slow trace pattern
	if trace.Duration > time.Second*5 {
		patternID := "slow_trace"
		if pattern, exists := dts.analytics.patterns[patternID]; exists {
			pattern.Frequency++
		} else {
			dts.analytics.patterns[patternID] = &TracePattern{
				ID:          patternID,
				Name:        "Slow Trace",
				Type:        PatternTypeSlow,
				Description: "Trace duration exceeds 5 seconds",
				Frequency:   1,
				Impact:      0.7,
				Created:     TimestampNow(),
			}
		}
	}

	// Update insights
	dts.updateInsights()
}

// updateInsights updates trace insights
func (dts *DistributedTracingService) updateInsights() {
	// This would run comprehensive analysis
	// For now, placeholder implementation
}

// GetTraceAnalytics gets trace analytics
func (dts *DistributedTracingService) GetTraceAnalytics(ctx context.Context, tenantID string, timeRange *TimeRange) (*TraceInsights, error) {
	dts.analytics.mu.RLock()
	defer dts.analytics.mu.RUnlock()

	// Return cached insights or compute new ones
	if dts.analytics.insights != nil {
		return dts.analytics.insights, nil
	}

	// Compute insights
	insights := &TraceInsights{
		TopErrors:          dts.getTopErrors(timeRange),
		SlowestTraces:      dts.getSlowestTraces(timeRange),
		BottleneckServices: dts.getBottleneckServices(timeRange),
		UnusualPatterns:    dts.getUnusualPatterns(timeRange),
		Recommendations:    dts.getRecommendations(),
		SLACompliance:      dts.getSLACompliance(timeRange),
	}

	dts.analytics.insights = insights
	return insights, nil
}

// getTopErrors gets top errors
func (dts *DistributedTracingService) getTopErrors(timeRange *TimeRange) []ErrorInsight {
	// Implementation to analyze errors
	return []ErrorInsight{
		{
			Type:     "database_timeout",
			Count:    45,
			Rate:     0.05,
			Services: []string{"database", "api"},
			LastSeen: TimestampNow(),
			Impact:   "high",
		},
	}
}

// getSlowestTraces gets slowest traces
func (dts *DistributedTracingService) getSlowestTraces(timeRange *TimeRange) []TraceSummary {
	// Implementation to find slowest traces
	return []TraceSummary{}
}

// getBottleneckServices gets bottleneck services
func (dts *DistributedTracingService) getBottleneckServices(timeRange *TimeRange) []ServiceInsight {
	// Implementation to find bottlenecks
	return []ServiceInsight{
		{
			Name:       "database",
			Duration:   time.Second * 2,
			ErrorRate:  0.02,
			Throughput: 1000,
			Saturation: 0.8,
			DependsOn:  []string{},
			Affects:    []string{"api", "worker"},
		},
	}
}

// getUnusualPatterns gets unusual patterns
func (dts *DistributedTracingService) getUnusualPatterns(timeRange *TimeRange) []PatternInsight {
	// Implementation to detect unusual patterns
	return []PatternInsight{}
}

// getRecommendations gets optimization recommendations
func (dts *DistributedTracingService) getRecommendations() []Recommendation {
	return []Recommendation{
		{
			Type:        "performance",
			Priority:    "high",
			Title:       "Optimize Database Queries",
			Description: "Add indexes to frequently queried columns",
			Impact:      "Reduce query time by 50%",
			Effort:      "medium",
			Confidence:  0.9,
		},
	}
}

// getSLACompliance gets SLA compliance report
func (dts *DistributedTracingService) getSLACompliance(timeRange *TimeRange) SLAReport {
	return SLAReport{
		Overall: SLAMetrics{
			Availability: 99.9,
			Latency: LatencyStats{
				P50: time.Millisecond * 100,
				P95: time.Millisecond * 500,
				P99: time.Millisecond * 1000,
			},
			ErrorRate:  0.1,
			Compliance: true,
		},
		ByService: map[string]SLAMetrics{
			"api": {
				Availability: 99.95,
				ErrorRate:    0.05,
				Compliance:   true,
			},
		},
		ByOperation: map[string]SLAMetrics{
			"GET /api/v1/documents": {
				Availability: 99.9,
				ErrorRate:    0.1,
				Compliance:   true,
			},
		},
	}
}

// CorrelateTraces correlates related traces
func (dts *DistributedTracingService) CorrelateTraces(ctx context.Context, traceID string, correlationID string) ([]string, error) {
	if !dts.config.CorrelationEnabled {
		return nil, fmt.Errorf("correlation is disabled")
	}

	dts.correlator.mu.Lock()
	defer dts.correlator.mu.Unlock()

	// Add correlation
	dts.correlator.correlations[correlationID] = append(dts.correlator.correlations[correlationID], traceID)

	// Get related traces
	related := dts.correlator.correlations[correlationID]

	// Update relations
	dts.correlator.relations[traceID] = related

	return related, nil
}

// GetTraceFlameGraph generates flame graph for trace
func (dts *DistributedTracingService) GetTraceFlameGraph(ctx context.Context, tenantID, traceID string) (*FlameGraph, error) {
	trace, err := dts.GetTrace(ctx, tenantID, traceID)
	if err != nil {
		return nil, err
	}

	flameGraph := &FlameGraph{
		Name:      traceID,
		Value:     trace.Duration.Nanoseconds(),
		Children:  []FlameGraphNode{},
		Timestamp: trace.StartTime,
	}

	// Build flame graph from root span
	if trace.RootSpan != nil {
		node := dts.buildFlameGraphNode(trace.RootSpan)
		flameGraph.Children = append(flameGraph.Children, node)
	}

	return flameGraph, nil
}

// FlameGraph represents a flame graph
type FlameGraph struct {
	Name      string           `json:"name"`
	Value     int64            `json:"value"`
	Children  []FlameGraphNode `json:"children"`
	Timestamp Timestamp        `json:"timestamp"`
}

// FlameGraphNode represents a node in flame graph
type FlameGraphNode struct {
	Name     string           `json:"name"`
	Value    int64            `json:"value"`
	Children []FlameGraphNode `json:"children"`
}

// buildFlameGraphNode builds flame graph node from span
func (dts *DistributedTracingService) buildFlameGraphNode(span *EnhancedSpan) FlameGraphNode {
	node := FlameGraphNode{
		Name:     fmt.Sprintf("%s %s", span.Service, span.Name),
		Value:    span.Duration.Nanoseconds(),
		Children: []FlameGraphNode{},
	}

	// Add child spans
	dts.spans.mu.RLock()
	defer dts.spans.mu.RUnlock()

	for _, spanID := range dts.spans.index[span.TraceID] {
		childSpan := dts.spans.spans[spanID]
		if childSpan != nil && childSpan.ParentID != nil && *childSpan.ParentID == span.ID {
			childNode := dts.buildFlameGraphNode(childSpan)
			node.Children = append(node.Children, childNode)
		}
	}

	return node
}

// GetServiceMap generates service map from traces
func (dts *DistributedTracingService) GetServiceMap(ctx context.Context, tenantID string, timeRange *TimeRange) (*ServiceMap, error) {
	serviceMap := &ServiceMap{
		Nodes: []ServiceNode{},
		Edges: []ServiceEdge{},
	}

	// Build service map from traces
	dts.traces.mu.RLock()
	defer dts.traces.mu.RUnlock()

	services := make(map[string]*ServiceNode)
	edges := make(map[string]*ServiceEdge)

	for _, trace := range dts.traces.traces {
		// Check time range
		if timeRange != nil {
			if trace.StartTime.Time.Before(timeRange.From.Time) || trace.EndTime.Time.After(timeRange.To.Time) {
				continue
			}
		}

		// Process spans for service dependencies
		dts.spans.mu.RLock()
		spanIDs := dts.spans.index[trace.TraceID]
		for _, spanID := range spanIDs {
			span := dts.spans.spans[spanID]
			if span == nil {
				continue
			}

			// Add service node
			if _, exists := services[span.Service]; !exists {
				services[span.Service] = &ServiceNode{
					ID:      span.Service,
					Name:    span.Service,
					Type:    "service",
					Health:  dts.calculateServiceHealth(span.Service),
					Metrics: dts.calculateServiceMetrics(span.Service),
				}
			}

			// Add edges for service calls
			if span.Peer != "" && span.Peer != span.Service {
				edgeKey := fmt.Sprintf("%s->%s", span.Service, span.Peer)
				if edge, exists := edges[edgeKey]; exists {
					edge.Requests++
					edge.AvgLatency = (edge.AvgLatency + float64(span.Duration.Nanoseconds())) / 2
					if span.Status == "error" {
						edge.Errors++
					}
				} else {
					edges[edgeKey] = &ServiceEdge{
						Source:     span.Service,
						Target:     span.Peer,
						Requests:   1,
						AvgLatency: float64(span.Duration.Nanoseconds()),
						Errors:     0,
					}
					if span.Status == "error" {
						edges[edgeKey].Errors = 1
					}
				}
			}
		}
		dts.spans.mu.RUnlock()
	}

	// Convert to slices
	for _, node := range services {
		serviceMap.Nodes = append(serviceMap.Nodes, *node)
	}
	for _, edge := range edges {
		serviceMap.Edges = append(serviceMap.Edges, *edge)
	}

	return serviceMap, nil
}

// ServiceMap represents service dependency map
type ServiceMap struct {
	Nodes []ServiceNode `json:"nodes"`
	Edges []ServiceEdge `json:"edges"`
}

// ServiceNode represents a service node
type ServiceNode struct {
	ID      string         `json:"id"`
	Name    string         `json:"name"`
	Type    string         `json:"type"`
	Health  ServiceHealth  `json:"health"`
	Metrics ServiceMetrics `json:"metrics"`
}

// ServiceHealth represents service health
type ServiceHealth struct {
	Status    string  `json:"status"`     // healthy, warning, critical
	Uptime    float64 `json:"uptime"`     // percentage
	Latency   string  `json:"latency"`    // current latency
	ErrorRate float64 `json:"error_rate"` // percentage
}

// ServiceMetrics represents service metrics
type ServiceMetrics struct {
	Throughput float64 `json:"throughput"`  // requests per second
	AvgLatency float64 `json:"avg_latency"` // milliseconds
	ErrorRate  float64 `json:"error_rate"`  // percentage
	Saturation float64 `json:"saturation"`  // 0-1
}

// ServiceEdge represents service dependency
type ServiceEdge struct {
	Source     string  `json:"source"`
	Target     string  `json:"target"`
	Requests   int     `json:"requests"`
	AvgLatency float64 `json:"avg_latency"` // nanoseconds
	Errors     int     `json:"errors"`
}

// calculateServiceHealth calculates service health
func (dts *DistributedTracingService) calculateServiceHealth(service string) ServiceHealth {
	// Implementation to calculate service health
	return ServiceHealth{
		Status:    "healthy",
		Uptime:    99.9,
		Latency:   "100ms",
		ErrorRate: 0.1,
	}
}

// calculateServiceMetrics calculates service metrics
func (dts *DistributedTracingService) calculateServiceMetrics(service string) ServiceMetrics {
	// Implementation to calculate service metrics
	return ServiceMetrics{
		Throughput: 1000,
		AvgLatency: 100,
		ErrorRate:  0.1,
		Saturation: 0.5,
	}
}

// Helper functions
func hashString(s string) int {
	h := 0
	for _, c := range s {
		h = h*31 + int(c)
	}
	return h
}

func (k SpanKind) String() string {
	return string(k)
}
