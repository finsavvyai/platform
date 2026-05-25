package sdln

import (
	"context"
	"io"
	"net/http"
	"time"
)

// Core interfaces for the SDLC.ai Go SDK

// ========================================
// Client Interfaces
// ========================================

// Client represents the main SDK client interface
type ClientInterface interface {
	// Service access
	Users() UserServiceInterface
	Tenants() TenantServiceInterface
	Documents() DocumentServiceInterface
	RAG() RAGServiceInterface
	Vector() VectorServiceInterface
	Policies() PoliciesServiceInterface
	LLM() LLMServiceInterface
	Monitoring() MonitoringServiceInterface
	WebSocket() WebSocketServiceInterface
	DLP() DLPServiceInterface
	Seamless() SeamlessServiceInterface
	LearningEngine() LearningEngineInterface
	PerformanceOptimizer() PerformanceOptimizerInterface
	QuantumCryptoManager() QuantumCryptoManagerInterface
	ComplianceEngine() ComplianceEngineInterface

	// Client operations
	Use(middleware Middleware)
	Close() error
}

// ========================================
// Service Interfaces
// ========================================

// UserServiceInterface defines user management operations
type UserServiceInterface interface {
	Create(ctx context.Context, req *CreateUserRequest) (*User, error)
	Get(ctx context.Context, userID string) (*User, error)
	GetByEmail(ctx context.Context, email string) (*User, error)
	List(ctx context.Context, opts *ListOptions) (*PaginatedResponse[User], error)
	Update(ctx context.Context, userID string, req *UpdateUserRequest) (*User, error)
	Delete(ctx context.Context, userID string) error
	BulkCreate(ctx context.Context, users []*CreateUserRequest) (*BulkResult[User], error)
	BulkUpdate(ctx context.Context, updates map[string]*UpdateUserRequest) (*BulkResult[User], error)
	BulkDelete(ctx context.Context, userIDs []string) (*BulkDeleteResult, error)
	ChangePassword(ctx context.Context, userID string, currentPassword, newPassword string) error
	ResetPassword(ctx context.Context, userID string) (*ResetPasswordResponse, error)
	Suspend(ctx context.Context, userID string, reason string) error
	Unsuspend(ctx context.Context, userID string) error
	GetActivity(ctx context.Context, userID string, opts *ListOptions) (*PaginatedResponse[UserActivity], error)
}

// TenantServiceInterface defines tenant management operations
type TenantServiceInterface interface {
	Create(ctx context.Context, req *CreateTenantRequest) (*Tenant, error)
	Get(ctx context.Context, tenantID string) (*Tenant, error)
	GetByDomain(ctx context.Context, domain string) (*Tenant, error)
	List(ctx context.Context, opts *ListOptions) (*PaginatedResponse[Tenant], error)
	Update(ctx context.Context, tenantID string, req *UpdateTenantRequest) (*Tenant, error)
	Delete(ctx context.Context, tenantID string) error
	GetHierarchy(ctx context.Context, tenantID string) (*TenantHierarchy, error)
	GetChildren(ctx context.Context, tenantID string, opts *ListOptions) (*PaginatedResponse[Tenant], error)
	CreateChild(ctx context.Context, parentID string, req *CreateTenantRequest) (*Tenant, error)
	Suspend(ctx context.Context, tenantID string, reason string) error
	Unsuspend(ctx context.Context, tenantID string) error
	GetUsage(ctx context.Context, tenantID string) (*TenantUsage, error)
	GetSettings(ctx context.Context, tenantID string) (*TenantSettings, error)
	UpdateSettings(ctx context.Context, tenantID string, settings *TenantSettings) error
}

// DocumentServiceInterface defines document management operations
type DocumentServiceInterface interface {
	Upload(ctx context.Context, req *UploadRequest) (*Document, error)
	UploadFromPath(ctx context.Context, filePath string, tenantID string, metadata DocumentMetadata) (*Document, error)
	Get(ctx context.Context, documentID string) (*Document, error)
	List(ctx context.Context, opts *ListOptions) (*PaginatedResponse[Document], error)
	Update(ctx context.Context, documentID string, metadata *DocumentMetadata, tags []string) (*Document, error)
	Delete(ctx context.Context, documentID string) error
	GetContent(ctx context.Context, documentID string) (*DocumentContent, error)
	Download(ctx context.Context, documentID string) (io.ReadCloser, *DocumentInfo, error)
	Search(ctx context.Context, query string, opts *SearchOptions) (*SearchResponse[Document], error)
	BatchDelete(ctx context.Context, documentIDs []string) (*BulkDeleteResult, error)
	GetProcessingStatus(ctx context.Context, documentID string) (*ProcessingStatus, error)
}

// RAGServiceInterface defines RAG operations
type RAGServiceInterface interface {
	Query(ctx context.Context, req *QueryRequest) (*RAGResponse, error)
	QueryStream(ctx context.Context, req *QueryRequest) (<-chan *StreamingRAGResponse, error)
	GetHistory(ctx context.Context, conversationID string, opts *ListOptions) (*PaginatedResponse[ConversationMessage], error)
	CreateConversation(ctx context.Context, tenantID, userID string, metadata map[string]string) (*Conversation, error)
	GetConversation(ctx context.Context, conversationID string) (*Conversation, error)
	DeleteConversation(ctx context.Context, conversationID string) error
	GetFeedback(ctx context.Context, queryID string) (*QueryFeedback, error)
	SubmitFeedback(ctx context.Context, queryID string, feedback *FeedbackRequest) error
}

// VectorServiceInterface defines vector database operations
type VectorServiceInterface interface {
	Create(ctx context.Context, req *VectorCreateRequest) (*VectorCreateResult, error)
	Upsert(ctx context.Context, req *VectorCreateRequest) (*VectorCreateResult, error)
	Get(ctx context.Context, tenantID, namespace, vectorID string, includeVector bool) (*Vector, error)
	Delete(ctx context.Context, tenantID, namespace string, vectorIDs []string) (*VectorDeleteResult, error)
	Search(ctx context.Context, req *SearchRequest) (*SearchResponse, error)
	BatchSearch(ctx context.Context, requests []SearchRequest) ([]*SearchResponse, error)
	CreateIndex(ctx context.Context, req *CreateIndexRequest) (*Index, error)
	GetIndex(ctx context.Context, tenantID, indexID string) (*Index, error)
	ListIndexes(ctx context.Context, tenantID string, opts *ListOptions) (*PaginatedResponse[Index], error)
	DeleteIndex(ctx context.Context, tenantID, indexID string) error
	CreateNamespace(ctx context.Context, tenantID, name, description string) (*Namespace, error)
	GetNamespace(ctx context.Context, tenantID, namespace string) (*Namespace, error)
	ListNamespaces(ctx context.Context, tenantID string, opts *ListOptions) (*PaginatedResponse[Namespace], error)
	DeleteNamespace(ctx context.Context, tenantID, namespace string) error
	GetStats(ctx context.Context, tenantID, namespace string) (*VectorStats, error)
}

// PoliciesServiceInterface defines policy management operations
type PoliciesServiceInterface interface {
	Create(ctx context.Context, req *CreatePolicyRequest) (*Policy, error)
	Get(ctx context.Context, tenantID, policyID string) (*Policy, error)
	List(ctx context.Context, tenantID string, opts *PolicyListOptions) (*PaginatedResponse[Policy], error)
	Update(ctx context.Context, tenantID, policyID string, req *UpdatePolicyRequest) (*Policy, error)
	Delete(ctx context.Context, tenantID, policyID string) error
	Evaluate(ctx context.Context, req *PolicyEvaluationRequest) (*PolicyEvaluationResult, error)
	BatchEvaluate(ctx context.Context, requests []PolicyEvaluationRequest) ([]*PolicyEvaluationResult, error)
	Activate(ctx context.Context, tenantID, policyID string) error
	Deactivate(ctx context.Context, tenantID, policyID string) error
	Test(ctx context.Context, tenantID, policyID string, testData map[string]interface{}) (*PolicyTestResult, error)
	GetTemplates(ctx context.Context, opts *TemplateListOptions) (*PaginatedResponse[PolicyTemplate], error)
	CreateFromTemplate(ctx context.Context, tenantID, templateID string, variables map[string]interface{}, req *CreatePolicyRequest) (*Policy, error)
	GetPolicyUsage(ctx context.Context, tenantID, policyID string, timeRange *TimestampRange) (*PolicyUsage, error)
	GetPolicyMetrics(ctx context.Context, tenantID string, timeRange *TimestampRange) (*PolicyMetrics, error)
}

// LLMServiceInterface defines LLM operations
type LLMServiceInterface interface {
	CreateChatCompletion(ctx context.Context, req *ChatCompletionRequest) (*ChatCompletionResponse, error)
	CreateChatCompletionStream(ctx context.Context, req *ChatCompletionRequest) (<-chan *StreamingChatCompletionChunk, error)
	CreateCompletion(ctx context.Context, req *CompletionRequest) (*CompletionResponse, error)
	CreateEmbedding(ctx context.Context, req *EmbeddingRequest) (*EmbeddingResponse, error)
	CreateModeration(ctx context.Context, req *ModerationRequest) (*ModerationResponse, error)
	ListModels(ctx context.Context) ([]Model, error)
	GetModel(ctx context.Context, modelID string) (*Model, error)
	CreateFineTuningJob(ctx context.Context, req *FineTuningRequest) (*FineTuningJob, error)
	GetFineTuningJob(ctx context.Context, jobID string) (*FineTuningJob, error)
	ListFineTuningJobs(ctx context.Context, tenantID string, opts *ListOptions) (*PaginatedResponse[FineTuningJob], error)
	CancelFineTuningJob(ctx context.Context, jobID string) (*FineTuningJob, error)
	GetUsage(ctx context.Context, tenantID string, timeRange *TimestampRange) (*LLMUsage, error)
	GetModelMetrics(ctx context.Context, tenantID string, timeRange *TimestampRange) (*ModelMetrics, error)
}

// MonitoringServiceInterface defines monitoring operations
type MonitoringServiceInterface interface {
	PushMetrics(ctx context.Context, tenantID string, metrics []Metric) error
	QueryMetrics(ctx context.Context, queries []MetricQuery) ([]MetricSeries, error)
	GetMetrics(ctx context.Context, tenantID string, timeRange *TimestampRange, metricNames []string) (map[string][]MetricSeries, error)
	CreateAlertRule(ctx context.Context, tenantID string, req *CreateAlertRuleRequest) (*AlertRule, error)
	GetAlertRule(ctx context.Context, tenantID, ruleID string) (*AlertRule, error)
	ListAlertRules(ctx context.Context, tenantID string, opts *ListOptions) (*PaginatedResponse[AlertRule], error)
	UpdateAlertRule(ctx context.Context, tenantID, ruleID string, req *UpdateAlertRuleRequest) (*AlertRule, error)
	DeleteAlertRule(ctx context.Context, tenantID, ruleID string) error
	ListAlerts(ctx context.Context, tenantID string, opts *AlertListOptions) (*PaginatedResponse[Alert], error)
	AcknowledgeAlert(ctx context.Context, tenantID, alertID string, comment string) error
	ResolveAlert(ctx context.Context, tenantID, alertID string, comment string) error
	CreateDashboard(ctx context.Context, tenantID string, dashboard *Dashboard) (*Dashboard, error)
	GetDashboard(ctx context.Context, tenantID, dashboardID string) (*Dashboard, error)
	ListDashboards(ctx context.Context, tenantID string, opts *DashboardListOptions) (*PaginatedResponse[Dashboard], error)
	UpdateDashboard(ctx context.Context, tenantID, dashboardID string, dashboard *Dashboard) (*Dashboard, error)
	DeleteDashboard(ctx context.Context, tenantID, dashboardID string) error
	GetHealth(ctx context.Context, tenantID string, checks []string) (*HealthStatus, error)
	QueryLogs(ctx context.Context, tenantID string, query *LogQuery) (*LogResponse, error)
	GetTrace(ctx context.Context, tenantID, traceID string) (*Trace, error)
	SearchTraces(ctx context.Context, tenantID string, opts *TraceSearchOptions) (*PaginatedResponse[Trace], error)
	GetSystemMetrics(ctx context.Context, timeRange *TimestampRange) (*SystemMetrics, error)
}

// MonitoringEnhancedInterface defines enhanced monitoring operations with ML-based features
type MonitoringEnhancedInterface interface {
	// Anomaly detection
	CreateAnomalyDetector(ctx context.Context, tenantID string, req *AnomalyDetectionRequest) (*AnomalyDetector, error)
	GetAnomalyDetector(ctx context.Context, tenantID, detectorID string) (*AnomalyDetector, error)
	ListAnomalyDetectors(ctx context.Context, tenantID string, opts *ListOptions) (*PaginatedResponse[AnomalyDetector], error)
	UpdateAnomalyDetector(ctx context.Context, tenantID, detectorID string, req *AnomalyDetectionRequest) (*AnomalyDetector, error)
	DeleteAnomalyDetector(ctx context.Context, tenantID, detectorID string) error
	ListAnomalies(ctx context.Context, tenantID string, opts *AnomalyListOptions) (*PaginatedResponse[Anomaly], error)

	// Incident management
	CreateIncident(ctx context.Context, tenantID string, req *CreateIncidentRequest) (*Incident, error)
	GetIncident(ctx context.Context, tenantID, incidentID string) (*Incident, error)
	ListIncidents(ctx context.Context, tenantID string, opts *IncidentListOptions) (*PaginatedResponse[Incident], error)
	UpdateIncident(ctx context.Context, tenantID, incidentID string, incident *Incident) (*Incident, error)
	ResolveIncident(ctx context.Context, tenantID, incidentID, resolution string) error

	// Runbook automation
	CreateRunbook(ctx context.Context, tenantID string, runbook *Runbook) (*Runbook, error)
	GetRunbook(ctx context.Context, tenantID, runbookID string) (*Runbook, error)
	ListRunbooks(ctx context.Context, tenantID string, opts *ListOptions) (*PaginatedResponse[Runbook], error)
	ExecuteRunbook(ctx context.Context, tenantID, runbookID string, trigger RunbookTrigger, triggeredBy string) (*RunbookExecution, error)
	GetRunbookExecution(ctx context.Context, tenantID, executionID string) (*RunbookExecution, error)
	ListRunbookExecutions(ctx context.Context, tenantID string, opts *ExecutionListOptions) (*PaginatedResponse[RunbookExecution], error)

	// Capacity planning
	GenerateCapacityPlan(ctx context.Context, tenantID string, timeRange TimestampRange, options *CapacityPlanningOptions) (*CapacityPlan, error)

	// Business metrics
	GetBusinessMetrics(ctx context.Context, tenantID string, timeRange TimestampRange, metrics []string) (*BusinessMetrics, error)
}

// WebSocketServiceInterface defines WebSocket operations
type WebSocketServiceInterface interface {
	Connect(ctx context.Context) (*Connection, error)
	ConnectWithAuth(ctx context.Context, token string) (*Connection, error)
	GetConnectionStatus(ctx context.Context, connectionID string) (*ConnectionStatus, error)
	ListActiveConnections(ctx context.Context, tenantID string, opts *ListOptions) (*PaginatedResponse[ConnectionInfo], error)
	BroadcastEvent(ctx context.Context, req *BroadcastRequest) error
}

// DLPServiceInterface defines Data Loss Prevention operations
type DLPServiceInterface interface {
	Scan(ctx context.Context, text string, options *DLPScanOptions) (*DLPScanResult, error)
	ScanAndRedact(ctx context.Context, text string, options *DLPScanRequest) (*DLPScanResult, error)
	ScanDocument(ctx context.Context, documentID string, options *DLPScanOptions) (*DLPScanResult, error)
	Redact(ctx context.Context, text string, pattern string, method string) (string, error)
	Tokenize(ctx context.Context, text string) (*TokenizationResult, error)
	Detokenize(ctx context.Context, tokens string) (string, error)
	GetPatterns(ctx context.Context, tenantID string) ([]PIIPattern, error)
	CreatePattern(ctx context.Context, tenantID string, pattern *PIIPattern) (*PIIPattern, error)
	UpdatePattern(ctx context.Context, tenantID, patternID string, pattern *PIIPattern) (*PIIPattern, error)
	DeletePattern(ctx context.Context, tenantID, patternID string) error
	GetRiskScore(ctx context.Context, text string) (*RiskAssessment, error)
	ValidateCompliance(ctx context.Context, text string, regulations []string) (*ComplianceResult, error)
}

// SeamlessServiceInterface defines seamless orchestration operations
type SeamlessServiceInterface interface {
	Ask(ctx context.Context, query string, options *SeamlessOptions) (*SeamlessResponse, error)
	AskStream(ctx context.Context, query string, options *SeamlessOptions) (<-chan *StreamingSeamlessResponse, error)
	UploadDocument(ctx context.Context, filePath string, options *SeamlessOptions) (*Document, error)
	Search(ctx context.Context, query string, options *SeamlessOptions) (*SearchResults, error)
	GetInsights(ctx context.Context, topic string, options *SeamlessOptions) (*Insights, error)
	Analyze(ctx context.Context, text string, options *AnalysisOptions) (*AnalysisResult, error)
	Summarize(ctx context.Context, documents []string, options *SummaryOptions) (*SummaryResult, error)
	Extract(ctx context.Context, text string, entities []string, options *ExtractionOptions) (*ExtractionResult, error)
	Classify(ctx context.Context, text string, categories []string, options *ClassificationOptions) (*ClassificationResult, error)
	Translate(ctx context.Context, text string, targetLanguage string, options *TranslationOptions) (*TranslationResult, error)
}

// LearningEngineInterface defines learning engine operations
type LearningEngineInterface interface {
	OptimizePolicies(ctx context.Context, feedback []QueryFeedback) error
	ImproveRetrieval(ctx context.Context, metrics []RetrievalMetrics) error
	TuneLLMParameters(ctx context.Context, performance []LLMMetrics) error
	CollectFeedback(ctx context.Context, feedback *FeedbackRequest) error
	AnalyzePerformance(ctx context.Context, timeRange *TimestampRange) (*PerformanceAnalysis, error)
	GetRecommendations(ctx context.Context, tenantID string) ([]OptimizationRecommendation, error)
	ApplyRecommendation(ctx context.Context, tenantID string, recommendationID string) error
	GetLearningStatus(ctx context.Context, tenantID string) (*LearningStatus, error)
	EnableLearning(ctx context.Context, tenantID string, config *LearningConfig) error
	DisableLearning(ctx context.Context, tenantID string) error
	GetModels(ctx context.Context, tenantID string) ([]LearningModel, error)
	TrainModel(ctx context.Context, tenantID string, config *TrainingConfig) (*TrainingJob, error)
	GetTrainingJob(ctx context.Context, tenantID, jobID string) (*TrainingJob, error)
	CancelTrainingJob(ctx context.Context, tenantID, jobID string) error
}

// PerformanceOptimizerInterface defines performance optimization operations
type PerformanceOptimizerInterface interface {
	OptimizeCaching(ctx context.Context, tenantID string, config *CacheConfig) (*OptimizationResult, error)
	OptimizeQueries(ctx context.Context, tenantID string, config *QueryOptimizationConfig) (*OptimizationResult, error)
	OptimizeConnections(ctx context.Context, tenantID string, config *ConnectionConfig) (*OptimizationResult, error)
	GetPerformanceMetrics(ctx context.Context, tenantID string, timeRange *TimestampRange) (*PerformanceMetrics, error)
	GetBottlenecks(ctx context.Context, tenantID string) ([]Bottleneck, error)
	ApplyOptimization(ctx context.Context, tenantID string, optimization *OptimizationPlan) error
	GetOptimizationHistory(ctx context.Context, tenantID string) ([]OptimizationRecord, error)
	SetPerformanceBudget(ctx context.Context, tenantID string, budget *PerformanceBudget) error
	GetPerformanceBudget(ctx context.Context, tenantID string) (*PerformanceBudget, error)
	GetRecommendations(ctx context.Context, tenantID string) ([]PerformanceRecommendation, error)
}

// QuantumCryptoManagerInterface defines quantum cryptography operations
type QuantumCryptoManagerInterface interface {
	GenerateQuantumKey(ctx context.Context, config *QuantumKeyConfig) (*QuantumKey, error)
	EncryptQuantum(ctx context.Context, data []byte, keyID string) (*QuantumCiphertext, error)
	DecryptQuantum(ctx context.Context, ciphertext *QuantumCiphertext, keyID string) ([]byte, error)
	CreateQuantumSignature(ctx context.Context, data []byte, keyID string) (*QuantumSignature, error)
	VerifyQuantumSignature(ctx context.Context, data []byte, signature *QuantumSignature, keyID string) (bool, error)
	GetQuantumKey(ctx context.Context, keyID string) (*QuantumKey, error)
	RotateQuantumKey(ctx context.Context, keyID string) (*QuantumKey, error)
	RevokeQuantumKey(ctx context.Context, keyID string) error
	ListQuantumKeys(ctx context.Context, tenantID string) ([]*QuantumKey, error)
	GetQuantumKeyMetadata(ctx context.Context, keyID string) (*QuantumKeyMetadata, error)
}

// ComplianceEngineInterface defines compliance automation operations
type ComplianceEngineInterface interface {
	ValidateGDPR(ctx context.Context, data *DataSubjectData) (*GDPRValidationResult, error)
	ValidateHIPAA(ctx context.Context, data *ProtectedHealthInfo) (*HIPAAValidationResult, error)
	ValidateSOX(ctx context.Context, data *FinancialData) (*SOXValidationResult, error)
	ValidatePCIDSS(ctx context.Context, data *PaymentData) (*PCIDSSValidationResult, error)
	GenerateComplianceReport(ctx context.Context, tenantID string, regulation string, timeRange *TimestampRange) (*ComplianceReport, error)
	GetComplianceStatus(ctx context.Context, tenantID string) (*ComplianceStatus, error)
	ScanCompliance(ctx context.Context, tenantID string) (*ComplianceScanResult, error)
	RemediateComplianceIssue(ctx context.Context, tenantID string, issueID string) (*RemediationResult, error)
	GetComplianceMetrics(ctx context.Context, tenantID string, timeRange *TimestampRange) (*ComplianceMetrics, error)
	SetCompliancePolicy(ctx context.Context, tenantID string, policy *CompliancePolicy) error
	GetCompliancePolicy(ctx context.Context, tenantID string, regulation string) (*CompliancePolicy, error)
}

// ConnectionInterface defines WebSocket connection operations
type ConnectionInterface interface {
	Subscribe(req *SubscribeRequest) error
	Unsubscribe(req *UnsubscribeRequest) error
	Send(messageType string, data map[string]interface{}) error
	Events() <-chan []byte
	Errors() <-chan error
	IsConnected() bool
	SetMessageHandler(handler func(message []byte))
	SetErrorHandler(handler func(err error))
	SetCloseHandler(handler func())
	Close() error
}

// ========================================
// Authentication Interfaces
// ========================================

// Authenticator defines authentication methods
type Authenticator interface {
	Authenticate(ctx context.Context, req HTTPRequest) error
	IsValid() bool
	Refresh(ctx context.Context) error
	Invalidate()
}

// ========================================
// Middleware Interfaces
// ========================================

// Middleware defines request/response middleware
type Middleware interface {
	BeforeRequest(ctx context.Context, req HTTPRequest) error
	AfterResponse(ctx context.Context, resp *HTTPResponse) error
}

// ========================================
// Configuration Interfaces
// ========================================

// Configurator defines configuration methods
type Configurator interface {
	SetBaseURL(url string) error
	SetTimeout(timeout time.Duration) error
	SetRetryConfig(config *RetryConfig) error
	SetDebug(debug bool) error
	GetConfig() *Config
}

// ========================================
// Utility Interfaces
// ========================================

// Logger defines logging interface
type Logger interface {
	Debug(msg string, fields ...interface{})
	Info(msg string, fields ...interface{})
	Warn(msg string, fields ...interface{})
	Error(msg string, err error, fields ...interface{})
	Fatal(msg string, err error, fields ...interface{})
}

// MetricsCollector defines metrics collection interface
type MetricsCollector interface {
	Counter(name string, tags map[string]string) Counter
	Gauge(name string, tags map[string]string) Gauge
	Histogram(name string, tags map[string]string) Histogram
	Timer(name string, tags map[string]string) Timer
}

// Counter defines counter metric interface
type Counter interface {
	Add(value float64)
	Inc()
}

// Gauge defines gauge metric interface
type Gauge interface {
	Set(value float64)
	Add(value float64)
	Sub(value float64)
}

// Histogram defines histogram metric interface
type Histogram interface {
	Observe(value float64)
}

// Timer defines timer metric interface
type Timer interface {
	Record(duration time.Duration)
	Start() Stopwatch
}

// Stopwatch defines stopwatch interface
type Stopwatch interface {
	Stop() time.Duration
}

// ========================================
// Validation Interfaces
// ========================================

// Validator defines validation interface
type Validator interface {
	Validate(value interface{}) error
	ValidateStruct(value interface{}) ValidationErrors
	AddRule(name string, rule ValidationRule)
}

// ValidationRule defines validation rule interface
type ValidationRule interface {
	Name() string
	Validate(value interface{}) error
	Message() string
}

// ========================================
// Cache Interfaces
// ========================================

// Cache defines cache interface
type Cache interface {
	Get(key string) (interface{}, bool)
	Set(key string, value interface{}, ttl time.Duration) error
	Delete(key string) error
	Clear() error
	Keys() []string
	Size() int
}

// CacheSerializer defines cache serialization interface
type CacheSerializer interface {
	Serialize(value interface{}) ([]byte, error)
	Deserialize(data []byte, value interface{}) error
}

// ========================================
// Crypto Interfaces
// ========================================

// ========================================
// Rate Limiting Interfaces
// ========================================

// RateLimiter defines rate limiting interface
type RateLimiter interface {
	Allow(key string) bool
	AllowN(key string, n int) bool
	Reserve(key string) *Reservation
	Wait(ctx context.Context, key string) error
	Limit(key string) RateLimit
}

// RateLimit defines rate limit information
type RateLimit struct {
	Rate  float64
	Burst int
}

// Reservation defines a rate limit reservation
type Reservation interface {
	Delay() time.Duration
	DelayFrom(now time.Time) time.Duration
	Cancel()
	OK() bool
	CancelAt(now time.Time)
}

// ========================================
// Circuit Breaker Interfaces
// ========================================

// CircuitBreaker defines circuit breaker interface
type CircuitBreaker interface {
	Execute(fn func() error) error
	ExecuteWithContext(ctx context.Context, fn func() error) error
	State() CircuitBreakerState
	IsOpen() bool
	IsHalfOpen() bool
	IsClosed() bool
	Reset()
	Trip(err error)
}

// CircuitBreakerState represents circuit breaker state
type CircuitBreakerState int

const (
	CircuitBreakerClosed CircuitBreakerState = iota
	CircuitBreakerHalfOpen
	CircuitBreakerOpen
)

// ========================================
// Retry Interfaces
// ========================================

// Retrier defines retry interface
type Retrier interface {
	Do(ctx context.Context, fn func() error) error
	DoWithContext(ctx context.Context, fn func(context.Context) error) error
	DoWithResult(ctx context.Context, fn func() (interface{}, error)) (interface{}, error)
}

// RetryStrategy defines retry strategy interface
type RetryStrategy interface {
	ShouldRetry(attempt int, err error) bool
	NextDelay(attempt int, err error) time.Duration
}

// ========================================
// Pool Interfaces
// ========================================

// Pool defines generic pool interface
type Pool[T any] interface {
	Get() (T, error)
	Put(item T) error
	Close() error
	Len() int
	Available() int
}

// WorkerPool defines worker pool interface
type WorkerPool interface {
	Submit(task func()) error
	SubmitAndWait(task func()) error
	Close() error
	Wait()
	Size() int
	Running() int
	Queued() int
	Completed() int64
}

// ========================================
// HTTP Client Interfaces
// ========================================

// HTTPClient defines HTTP client interface
// HTTPTransport defines HTTP transport interface
type HTTPTransport interface {
	RoundTrip(req *http.Request) (*http.Response, error)
	CancelRequest(req *http.Request)
}

// ========================================
// Streaming Interfaces
// ========================================

// Streamer defines streaming interface
type Streamer interface {
	Stream(ctx context.Context) (<-chan []byte, error)
	Close() error
}

// EventStream defines event streaming interface
type EventStream interface {
	Events() <-chan Event
	Errors() <-chan error
	Close() error
}

// Event represents a streaming event
type Event struct {
	ID      string
	Type    string
	Data    []byte
	Headers map[string][]string
}

// ========================================
// Builder Interfaces
// ========================================

// ResponseBuilder defines response builder interface
type ResponseBuilder interface {
	Status(code int) ResponseBuilder
	Header(key, value string) ResponseBuilder
	Headers(headers map[string][]string) ResponseBuilder
	Body(body interface{}) ResponseBuilder
	Build() *HTTPResponse
}

// ========================================
// Testing Interfaces
// ========================================

// MockClient defines mock client interface for testing
type MockClient interface {
	ClientInterface
	SetResponses(responses map[string]interface{})
	SetErrors(errors map[string]error)
	Clear()
	GetCalls(method string) []interface{}
}

// TestServer defines test server interface
type TestServer interface {
	Start() error
	Stop() error
	URL() string
	Handle(pattern string, handler http.HandlerFunc)
	SetResponses(responses map[string]interface{})
	SetErrors(errors map[string]error)
}
