//go:build legacy_migrated
// +build legacy_migrated

package performance

import (
	"context"
	"database/sql"
	"net/http"
	"sync"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// BenchmarkConfig defines the configuration for benchmark tests
type BenchmarkConfig struct {
	// General settings
	ConcurrentUsers int           `yaml:"concurrent_users" json:"concurrent_users" validate:"min=1,max=1000"`
	TestDuration    time.Duration `yaml:"test_duration" json:"test_duration"`
	RampUpPeriod    time.Duration `yaml:"ramp_up_period" json:"ramp_up_period"`
	CooldownPeriod  time.Duration `yaml:"cool_down_period" json:"cool_down_period"`

	// Request settings
	RequestsPerSecond int           `yaml:"requests_per_second" json:"requests_per_second" validate:"min=1"`
	Timeout           time.Duration `yaml:"timeout" json:"timeout"`
	RetryAttempts     int           `yaml:"retry_attempts" json:"retry_attempts" validate:"min=0,max=5"`

	// Load patterns
	EnableSpikeLoad bool          `yaml:"enable_spike_load" json:"enable_spike_load"`
	SpikeMultiplier float64       `yaml:"spike_multiplier" json:"spike_multiplier" validate:"min=1.0,max=10.0"`
	SpikeDuration   time.Duration `yaml:"spike_duration" json:"spike_duration"`

	// Resource monitoring
	EnableProfiling       bool          `yaml:"enable_profiling" json:"enable_profiling"`
	MemoryProfileInterval time.Duration `yaml:"memory_profile_interval" json:"memory_profile_interval"`
	CPUProfileInterval    time.Duration `yaml:"cpu_profile_interval" json:"cpu_profile_interval"`

	// Output settings
	EnableVerboseLogging bool   `yaml:"enable_verbose_logging" json:"enable_verbose_logging"`
	OutputFormat         string `yaml:"output_format" json:"output_format" validate:"oneof=json csv html"`
	ReportDirectory      string `yaml:"report_directory" json:"report_directory"`

	// Database settings
	EnableDBMonitoring bool          `yaml:"enable_db_monitoring" json:"enable_db_monitoring"`
	DBMetricsInterval  time.Duration `yaml:"db_metrics_interval" json:"db_metrics_interval"`

	// Cache settings
	EnableCacheMonitoring bool          `yaml:"enable_cache_monitoring" json:"enable_cache_monitoring"`
	CacheMetricsInterval  time.Duration `yaml:"cache_metrics_interval" json:"cache_metrics_interval"`
}

// LoadTestScenario defines a specific load test scenario
type LoadTestScenario struct {
	Name            string                 `yaml:"name" json:"name"`
	Description     string                 `yaml:"description" json:"description"`
	Weight          int                    `yaml:"weight" json:"weight" validate:"min=1,max=100"`
	Requests        []RequestDefinition    `yaml:"requests" json:"requests"`
	ExpectedResults ExpectedResults        `yaml:"expected_results" json:"expected_results"`
	Timeout         time.Duration          `yaml:"timeout" json:"timeout"`
	RetryPolicy     RetryPolicy            `yaml:"retry_policy" json:"retry_policy"`
	Metadata        map[string]interface{} `yaml:"metadata" json:"metadata"`
}

// RequestDefinition defines a single HTTP request in a load test
type RequestDefinition struct {
	Method      string            `yaml:"method" json:"method" validate:"required,oneof=GET POST PUT DELETE PATCH HEAD OPTIONS"`
	Path        string            `yaml:"path" json:"path" validate:"required"`
	Headers     map[string]string `yaml:"headers" json:"headers"`
	Body        interface{}       `yaml:"body" json:"body"`
	QueryParams map[string]string `yaml:"query_params" json:"query_params"`
	Timeout     time.Duration     `yaml:"timeout" json:"timeout"`
	Weight      int               `yaml:"weight" json:"weight" validate:"min=1,max=100"`
	Assertions  []Assertion       `yaml:"assertions" json:"assertions"`
}

// Assertion defines validation rules for response
type Assertion struct {
	Type      string      `yaml:"type" json:"type" validate:"required,oneof=status_code response_time header body json_path"`
	Value     interface{} `yaml:"value" json:"value"`
	Operator  string      `yaml:"operator" json:"operator" validate:"required,oneof=equals not_equals greater_than less_than contains regex"`
	Tolerance float64     `yaml:"tolerance" json:"tolerance"`
}

// ExpectedResults defines the expected performance metrics
type ExpectedResults struct {
	ResponseTime time.Duration `yaml:"response_time" json:"response_time"`
	SuccessRate  float64       `yaml:"success_rate" json:"success_rate" validate:"min=0.0,max=1.0"`
	Throughput   int           `yaml:"throughput" json:"throughput"`
	ErrorRate    float64       `yaml:"error_rate" json:"error_rate" validate:"min=0.0,max=1.0"`
	MemoryUsage  int64         `yaml:"memory_usage" json:"memory_usage"`
	CPUUsage     float64       `yaml:"cpu_usage" json:"cpu_usage" validate:"min=0.0,max=100.0"`
}

// RetryPolicy defines retry behavior for failed requests
type RetryPolicy struct {
	MaxAttempts int           `yaml:"max_attempts" json:"max_attempts" validate:"min=0,max=10"`
	BackoffType string        `yaml:"backoff_type" json:"backoff_type" validate:"oneof=fixed exponential linear"`
	BaseDelay   time.Duration `yaml:"base_delay" json:"base_delay"`
	MaxDelay    time.Duration `yaml:"max_delay" json:"max_delay"`
}

// PerformanceMetrics holds all performance test results
type PerformanceMetrics struct {
	TestInfo        TestInfo                `json:"test_info"`
	Summary         TestSummary             `json:"summary"`
	RequestMetrics  map[string]*RequestStat `json:"request_metrics"`
	ResourceMetrics ResourceMetrics         `json:"resource_metrics"`
	DatabaseMetrics DatabaseMetrics         `json:"database_metrics"`
	CacheMetrics    CacheMetrics            `json:"cache_metrics"`
	ErrorAnalysis   ErrorAnalysis           `json:"error_analysis"`
	Percentiles     ResponseTimePercentiles `json:"percentiles"`
	TimelineData    []TimelineDataPoint     `json:"timeline_data"`
}

// TestInfo holds information about the test run
type TestInfo struct {
	TestName    string             `json:"test_name"`
	StartTime   time.Time          `json:"start_time"`
	EndTime     time.Time          `json:"end_time"`
	Duration    time.Duration      `json:"duration"`
	Config      BenchmarkConfig    `json:"config"`
	Scenarios   []LoadTestScenario `json:"scenarios"`
	Environment map[string]string  `json:"environment"`
	Version     string             `json:"version"`
	GitCommit   string             `json:"git_commit"`
}

// TestSummary provides overall test results
type TestSummary struct {
	TotalRequests       int64         `json:"total_requests"`
	SuccessfulRequests  int64         `json:"successful_requests"`
	FailedRequests      int64         `json:"failed_requests"`
	SuccessRate         float64       `json:"success_rate"`
	AverageRPS          float64       `json:"average_rps"`
	PeakRPS             float64       `json:"peak_rps"`
	AverageResponseTime time.Duration `json:"average_response_time"`
	MinResponseTime     time.Duration `json:"min_response_time"`
	MaxResponseTime     time.Duration `json:"max_response_time"`
	P50ResponseTime     time.Duration `json:"p50_response_time"`
	P95ResponseTime     time.Duration `json:"p95_response_time"`
	P99ResponseTime     time.Duration `json:"p99_response_time"`
	TotalBytesReceived  int64         `json:"total_bytes_received"`
	TotalBytesSent      int64         `json:"total_bytes_sent"`
}

// RequestStat holds metrics for a specific request type
type RequestStat struct {
	URL                 string           `json:"url"`
	Method              string           `json:"method"`
	TotalRequests       int64            `json:"total_requests"`
	SuccessfulRequests  int64            `json:"successful_requests"`
	FailedRequests      int64            `json:"failed_requests"`
	SuccessRate         float64          `json:"success_rate"`
	AverageResponseTime time.Duration    `json:"average_response_time"`
	MinResponseTime     time.Duration    `json:"min_response_time"`
	MaxResponseTime     time.Duration    `json:"max_response_time"`
	P50ResponseTime     time.Duration    `json:"p50_response_time"`
	P95ResponseTime     time.Duration    `json:"p95_response_time"`
	P99ResponseTime     time.Duration    `json:"p99_response_time"`
	BytesReceived       int64            `json:"bytes_received"`
	BytesSent           int64            `json:"bytes_sent"`
	ErrorCounts         map[string]int64 `json:"error_counts"`
	ResponseCodes       map[string]int64 `json:"response_codes"`
}

// ResourceMetrics holds system resource usage metrics
type ResourceMetrics struct {
	CPUUsage       []CPUDataPoint    `json:"cpu_usage"`
	MemoryUsage    []MemoryDataPoint `json:"memory_usage"`
	GoroutineCount []int64           `json:"goroutine_count"`
	GCStats        []GCDataPoint     `json:"gc_stats"`
}

// CPUDataPoint represents CPU usage at a point in time
type CPUDataPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Usage     float64   `json:"usage"`
}

// MemoryDataPoint represents memory usage at a point in time
type MemoryDataPoint struct {
	Timestamp    time.Time `json:"timestamp"`
	Alloc        uint64    `json:"alloc"`
	TotalAlloc   uint64    `json:"total_alloc"`
	Sys          uint64    `json:"sys"`
	NumGC        uint32    `json:"num_gc"`
	HeapAlloc    uint64    `json:"heap_alloc"`
	HeapSys      uint64    `json:"heap_sys"`
	HeapIdle     uint64    `json:"heap_idle"`
	HeapInuse    uint64    `json:"heap_inuse"`
	HeapReleased uint64    `json:"heap_released"`
}

// GCDataPoint represents garbage collection statistics
type GCDataPoint struct {
	Timestamp     time.Time     `json:"timestamp"`
	NumGC         uint32        `json:"num_gc"`
	NumForcedGC   uint32        `json:"num_forced_gc"`
	GCCPUFraction float64       `json:"gc_cpu_fraction"`
	TotalPauseNs  uint64        `json:"total_pause_ns"`
	TotalPause    time.Duration `json:"total_pause"`
}

// DatabaseMetrics holds database performance metrics
type DatabaseMetrics struct {
	Connections      []DBConnectionDataPoint  `json:"connections"`
	QueryStats       []DBQueryDataPoint       `json:"query_stats"`
	PerformanceStats []DBPerformanceDataPoint `json:"performance_stats"`
}

// DBConnectionDataPoint represents database connection statistics
type DBConnectionDataPoint struct {
	Timestamp         time.Time     `json:"timestamp"`
	OpenConnections   int           `json:"open_connections"`
	InUse             int           `json:"in_use"`
	Idle              int           `json:"idle"`
	WaitCount         int64         `json:"wait_count"`
	WaitDuration      time.Duration `json:"wait_duration"`
	MaxIdleClosed     int64         `json:"max_idle_closed"`
	MaxLifetimeClosed int64         `json:"max_lifetime_closed"`
}

// DBQueryDataPoint represents database query statistics
type DBQueryDataPoint struct {
	Timestamp    time.Time     `json:"timestamp"`
	QueryType    string        `json:"query_type"`
	TotalQueries int64         `json:"total_queries"`
	TotalTime    time.Duration `json:"total_time"`
	AverageTime  time.Duration `json:"average_time"`
	SlowQueries  int64         `json:"slow_queries"`
}

// DBPerformanceDataPoint represents database performance metrics
type DBPerformanceDataPoint struct {
	Timestamp   time.Time `json:"timestamp"`
	CPUUsage    float64   `json:"cpu_usage"`
	MemoryUsage uint64    `json:"memory_usage"`
	DiskIO      uint64    `json:"disk_io"`
	NetworkIO   uint64    `json:"network_io"`
}

// CacheMetrics holds Redis/cache performance metrics
type CacheMetrics struct {
	Connections []CacheConnectionDataPoint  `json:"connections"`
	Operations  []CacheOperationDataPoint   `json:"operations"`
	Performance []CachePerformanceDataPoint `json:"performance"`
}

// CacheConnectionDataPoint represents cache connection statistics
type CacheConnectionDataPoint struct {
	Timestamp        time.Time `json:"timestamp"`
	ConnectedClients int       `json:"connected_clients"`
	UsedMemory       uint64    `json:"used_memory"`
	MaxMemory        uint64    `json:"max_memory"`
	Hits             int64     `json:"hits"`
	Misses           int64     `json:"misses"`
	HitRate          float64   `json:"hit_rate"`
}

// CacheOperationDataPoint represents cache operation statistics
type CacheOperationDataPoint struct {
	Timestamp   time.Time     `json:"timestamp"`
	Operation   string        `json:"operation"`
	Count       int64         `json:"count"`
	AverageTime time.Duration `json:"average_time"`
	SuccessRate float64       `json:"success_rate"`
}

// CachePerformanceDataPoint represents cache performance metrics
type CachePerformanceDataPoint struct {
	Timestamp   time.Time `json:"timestamp"`
	CPUUsage    float64   `json:"cpu_usage"`
	MemoryUsage uint64    `json:"memory_usage"`
	NetworkIO   uint64    `json:"network_io"`
}

// ErrorAnalysis holds detailed error information
type ErrorAnalysis struct {
	TotalErrors      int64                 `json:"total_errors"`
	ErrorRate        float64               `json:"error_rate"`
	ErrorsByType     map[string]int64      `json:"errors_by_type"`
	ErrorsByEndpoint map[string]int64      `json:"errors_by_endpoint"`
	ErrorSamples     []ErrorSample         `json:"error_samples"`
	ErrorTrends      []ErrorTrendDataPoint `json:"error_trends"`
}

// ErrorSample represents a specific error instance
type ErrorSample struct {
	Timestamp    time.Time     `json:"timestamp"`
	URL          string        `json:"url"`
	Method       string        `json:"method"`
	StatusCode   int           `json:"status_code"`
	ErrorMsg     string        `json:"error_msg"`
	ResponseTime time.Duration `json:"response_time"`
	RequestID    string        `json:"request_id"`
}

// ErrorTrendDataPoint represents error rate over time
type ErrorTrendDataPoint struct {
	Timestamp  time.Time `json:"timestamp"`
	ErrorRate  float64   `json:"error_rate"`
	ErrorCount int64     `json:"error_count"`
}

// ResponseTimePercentiles holds response time percentile data
type ResponseTimePercentiles struct {
	P50  time.Duration `json:"p50"`
	P75  time.Duration `json:"p75"`
	P90  time.Duration `json:"p90"`
	P95  time.Duration `json:"p95"`
	P99  time.Duration `json:"p99"`
	P999 time.Duration `json:"p999"`
}

// TimelineDataPoint represents metrics at a specific point in time
type TimelineDataPoint struct {
	Timestamp    time.Time     `json:"timestamp"`
	RPS          float64       `json:"rps"`
	ResponseTime time.Duration `json:"response_time"`
	SuccessRate  float64       `json:"success_rate"`
	ActiveUsers  int           `json:"active_users"`
	ErrorsPerSec float64       `json:"errors_per_sec"`
}

// BenchmarkResult holds the complete results of a benchmark test
type BenchmarkResult struct {
	Metrics    *PerformanceMetrics `json:"metrics"`
	Success    bool                `json:"success"`
	Error      string              `json:"error,omitempty"`
	ReportPath string              `json:"report_path,omitempty"`
}

// BenchmarkEngine is the main performance testing engine
type BenchmarkEngine struct {
	config          *BenchmarkConfig
	logger          *zap.Logger
	httpClient      *http.Client
	db              *sqlx.DB
	redis           *redis.Client
	metrics         *PerformanceMetrics
	stats           map[string]*RequestStat
	errorCollector  *ErrorCollector
	profiler        *Profiler
	resourceMonitor *ResourceMonitor
	dbMonitor       *DatabaseMonitor
	cacheMonitor    *CacheMonitor

	// Synchronization
	mu     sync.RWMutex
	wg     sync.WaitGroup
	ctx    context.Context
	cancel context.CancelFunc

	// Channels
	requestChan chan *RequestTask
	resultChan  chan *RequestResult
	metricsChan chan *ResourceDataPoint
	errorChan   chan *ErrorSample

	// Counters
	totalRequests   int64
	successRequests int64
	failedRequests  int64
	bytesReceived   int64
	bytesSent       int64
	startTime       time.Time
	endTime         time.Time
}

// RequestTask represents a single HTTP request task
type RequestTask struct {
	ID        int                    `json:"id"`
	Scenario  *LoadTestScenario      `json:"scenario"`
	Request   *RequestDefinition     `json:"request"`
	StartTime time.Time              `json:"start_time"`
	Timeout   time.Duration          `json:"timeout"`
	UserData  map[string]interface{} `json:"user_data"`
}

// RequestResult represents the result of a single HTTP request
type RequestResult struct {
	TaskID        int                 `json:"task_id"`
	URL           string              `json:"url"`
	Method        string              `json:"method"`
	StatusCode    int                 `json:"status_code"`
	ResponseTime  time.Duration       `json:"response_time"`
	BytesReceived int64               `json:"bytes_received"`
	BytesSent     int64               `json:"bytes_sent"`
	Success       bool                `json:"success"`
	Error         string              `json:"error,omitempty"`
	Headers       map[string][]string `json:"headers"`
	Body          string              `json:"body,omitempty"`
	Assertions    []AssertionResult   `json:"assertions"`
	Timestamp     time.Time           `json:"timestamp"`
}

// AssertionResult represents the result of an assertion
type AssertionResult struct {
	Type     string      `json:"type"`
	Expected interface{} `json:"expected"`
	Actual   interface{} `json:"actual"`
	Passed   bool        `json:"passed"`
	Error    string      `json:"error,omitempty"`
}

// ErrorCollector collects and analyzes errors during tests
type ErrorCollector struct {
	errors       []ErrorSample
	errorsByType map[string]int64
	errorsByURL  map[string]int64
	trends       []ErrorTrendDataPoint
	mu           sync.RWMutex
}

// Profiler handles runtime profiling during tests
type Profiler struct {
	config    *BenchmarkConfig
	logger    *zap.Logger
	profiling bool
	mu        sync.RWMutex
}

// ResourceMonitor monitors system resources during tests
type ResourceMonitor struct {
	config     *BenchmarkConfig
	logger     *zap.Logger
	monitoring bool
	dataChan   chan *ResourceDataPoint
	mu         sync.RWMutex
}

// ResourceDataPoint represents a single resource measurement
type ResourceDataPoint struct {
	Timestamp  time.Time   `json:"timestamp"`
	CPU        float64     `json:"cpu"`
	Memory     uint64      `json:"memory"`
	Goroutines int64       `json:"goroutines"`
	GCStats    interface{} `json:"gc_stats"`
}

// DatabaseMonitor monitors database performance during tests
type DatabaseMonitor struct {
	config     *BenchmarkConfig
	logger     *zap.Logger
	db         *sqlx.DB
	monitoring bool
	dataChan   chan *DBDataPoint
	mu         sync.RWMutex
}

// DBDataPoint represents a single database measurement
type DBDataPoint struct {
	Timestamp time.Time     `json:"timestamp"`
	Stats     sql.DBStats   `json:"stats"`
	Queries   []DBQueryStat `json:"queries"`
}

// DBQueryStat represents statistics for a specific query
type DBQueryStat struct {
	Query    string        `json:"query"`
	Duration time.Duration `json:"duration"`
	Success  bool          `json:"success"`
	Error    string        `json:"error,omitempty"`
}

// CacheMonitor monitors Redis performance during tests
type CacheMonitor struct {
	config     *BenchmarkConfig
	logger     *zap.Logger
	redis      *redis.Client
	monitoring bool
	dataChan   chan *CacheDataPoint
	mu         sync.RWMutex
}

// CacheDataPoint represents a single cache measurement
type CacheDataPoint struct {
	Timestamp  time.Time            `json:"timestamp"`
	Stats      interface{}          `json:"stats"`
	Operations []CacheOperationStat `json:"operations"`
}

// CacheOperationStat represents statistics for a specific cache operation
type CacheOperationStat struct {
	Operation string        `json:"operation"`
	Key       string        `json:"key"`
	Duration  time.Duration `json:"duration"`
	Success   bool          `json:"success"`
	Error     string        `json:"error,omitempty"`
}