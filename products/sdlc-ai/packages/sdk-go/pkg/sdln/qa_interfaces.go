package sdln

import (
	"context"
)

// ========================================
// QA Service Interfaces
// ========================================

// QAServiceInterface defines quality assurance operations
type QAServiceInterface interface {
	// Static analysis
	ScanCode(ctx context.Context, req *CodeScanRequest) (*CodeScanResult, error)
	GetScanResults(ctx context.Context, scanID string) (*CodeScanResult, error)
	ListScans(ctx context.Context, opts *ListOptions) (*PaginatedResponse[CodeScanResult], error)
	ConfigureScanRules(ctx context.Context, config *ScanConfig) error
	GetScanConfig(ctx context.Context) (*ScanConfig, error)

	// Code review
	CreateReview(ctx context.Context, req *CreateReviewRequest) (*CodeReview, error)
	GetReview(ctx context.Context, reviewID string) (*CodeReview, error)
	ListReviews(ctx context.Context, opts *ReviewListOptions) (*PaginatedResponse[CodeReview], error)
	UpdateReview(ctx context.Context, reviewID string, req *UpdateReviewRequest) (*CodeReview, error)
	ApproveReview(ctx context.Context, reviewID string, comment string) error
	RequestChanges(ctx context.Context, reviewID string, changes []ReviewComment) error
	MergeReview(ctx context.Context, reviewID string, mergeStrategy string) error
	AutoReview(ctx context.Context, req *AutoReviewRequest) (*AutoReviewResult, error)

	// CI/CD
	CreatePipeline(ctx context.Context, req *CreatePipelineRequest) (*Pipeline, error)
	GetPipeline(ctx context.Context, pipelineID string) (*Pipeline, error)
	ListPipelines(ctx context.Context, opts *ListOptions) (*PaginatedResponse[Pipeline], error)
	UpdatePipeline(ctx context.Context, pipelineID string, req *UpdatePipelineRequest) (*Pipeline, error)
	DeletePipeline(ctx context.Context, pipelineID string) error
	TriggerPipeline(ctx context.Context, pipelineID string, req *TriggerRequest) (*PipelineExecution, error)
	GetPipelineExecution(ctx context.Context, executionID string) (*PipelineExecution, error)
	ListPipelineExecutions(ctx context.Context, pipelineID string, opts *ListOptions) (*PaginatedResponse[PipelineExecution], error)
	CancelPipelineExecution(ctx context.Context, executionID string) error

	// Performance benchmarking
	CreateBenchmark(ctx context.Context, req *CreateBenchmarkRequest) (*Benchmark, error)
	GetBenchmark(ctx context.Context, benchmarkID string) (*Benchmark, error)
	ListBenchmarks(ctx context.Context, opts *ListOptions) (*PaginatedResponse[Benchmark], error)
	RunBenchmark(ctx context.Context, benchmarkID string, config *BenchmarkConfig) (*BenchmarkResult, error)
	GetBenchmarkResult(ctx context.Context, resultID string) (*BenchmarkResult, error)
	ListBenchmarkResults(ctx context.Context, benchmarkID string, opts *ListOptions) (*PaginatedResponse[BenchmarkResult], error)
	CompareBenchmarkResults(ctx context.Context, resultIDs []string) (*BenchmarkComparison, error)

	// Quality metrics
	GetQualityMetrics(ctx context.Context, tenantID string, timeRange *TimestampRange) (*QualityMetrics, error)
	GetQualityTrends(ctx context.Context, tenantID string, timeRange *TimestampRange) (*QualityTrends, error)
	GetQualityScore(ctx context.Context, entityID string, entityType string) (*QualityScore, error)
	UpdateQualityScore(ctx context.Context, entityID string, entityType string, score float64, factors map[string]float64) error
	GenerateQualityReport(ctx context.Context, req *QualityReportRequest) (*QualityReport, error)

	// Compliance validation
	ValidateCompliance(ctx context.Context, req *ComplianceValidationRequest) (*ComplianceValidationResult, error)
	GetComplianceStatus(ctx context.Context, entityID string) (*ComplianceStatus, error)
	GetComplianceReport(ctx context.Context, req *ComplianceReportRequest) (*ComplianceReport, error)
	RemediateComplianceIssue(ctx context.Context, issueID string, remediation *ComplianceRemediation) (*RemediationResult, error)
	ListComplianceIssues(ctx context.Context, opts *ComplianceIssueListOptions) (*PaginatedResponse[ComplianceIssue], error)

	// Quality gates
	CreateQualityGate(ctx context.Context, req *CreateQualityGateRequest) (*QualityGate, error)
	GetQualityGate(ctx context.Context, gateID string) (*QualityGate, error)
	ListQualityGates(ctx context.Context, opts *ListOptions) (*PaginatedResponse[QualityGate], error)
	UpdateQualityGate(ctx context.Context, gateID string, req *UpdateQualityGateRequest) (*QualityGate, error)
	DeleteQualityGate(ctx context.Context, gateID string) error
	EvaluateQualityGate(ctx context.Context, gateID string, context *QualityGateContext) (*QualityGateResult, error)
}

// StaticAnalysisInterface defines static analysis operations
type StaticAnalysisInterface interface {
	// Code scanning
	ScanRepository(ctx context.Context, req *RepositoryScanRequest) (*ScanResult, error)
	ScanBranch(ctx context.Context, repoID, branch string) (*ScanResult, error)
	ScanPullRequest(ctx context.Context, repoID, prID string) (*ScanResult, error)
	ScanCommit(ctx context.Context, repoID, commitID string) (*ScanResult, error)

	// Security scanning
	ScanForVulnerabilities(ctx context.Context, req *VulnerabilityScanRequest) (*VulnerabilityScanResult, error)
	ScanDependencies(ctx context.Context, req *DependencyScanRequest) (*DependencyScanResult, error)
	ScanContainers(ctx context.Context, req *ContainerScanRequest) (*ContainerScanResult, error)
	ScanInfrastructure(ctx context.Context, req *InfrastructureScanRequest) (*InfrastructureScanResult, error)

	// Code quality
	AnalyzeComplexity(ctx context.Context, req *ComplexityAnalysisRequest) (*ComplexityAnalysisResult, error)
	AnalyzeCoverage(ctx context.Context, req *CoverageAnalysisRequest) (*CoverageAnalysisResult, error)
	AnalyzeDuplicates(ctx context.Context, req *DuplicateAnalysisRequest) (*DuplicateAnalysisResult, error)
	AnalyzeSmells(ctx context.Context, req *CodeSmellAnalysisRequest) (*CodeSmellAnalysisResult, error)

	// Technical debt
	CalculateTechnicalDebt(ctx context.Context, req *TechnicalDebtRequest) (*TechnicalDebtResult, error)
	GetDebtHotspots(ctx context.Context, req *DebtHotspotRequest) (*DebtHotspotResult, error)
	GenerateDebtReport(ctx context.Context, req *DebtReportRequest) (*TechnicalDebtReport, error)
}

// CodeReviewAutomationInterface defines automated code review operations
type CodeReviewAutomationInterface interface {
	// Automated review
	AnalyzeChanges(ctx context.Context, req *ChangeAnalysisRequest) (*ChangeAnalysisResult, error)
	SuggestImprovements(ctx context.Context, req *ImprovementRequest) (*ImprovementSuggestions, error)
	CheckStandards(ctx context.Context, req *StandardsCheckRequest) (*StandardsCheckResult, error)
	ValidateTests(ctx context.Context, req *TestValidationRequest) (*TestValidationResult, error)

	// Review templates
	CreateReviewTemplate(ctx context.Context, req *CreateReviewTemplateRequest) (*ReviewTemplate, error)
	GetReviewTemplate(ctx context.Context, templateID string) (*ReviewTemplate, error)
	ListReviewTemplates(ctx context.Context, opts *ListOptions) (*PaginatedResponse[ReviewTemplate], error)
	UpdateReviewTemplate(ctx context.Context, templateID string, req *UpdateReviewTemplateRequest) (*ReviewTemplate, error)
	DeleteReviewTemplate(ctx context.Context, templateID string) error

	// Review assignments
	AssignReviewers(ctx context.Context, req *AssignReviewersRequest) (*ReviewAssignment, error)
	GetOptimalReviewers(ctx context.Context, req *OptimalReviewerRequest) (*OptimalReviewers, error)
	ReviewLoadBalancing(ctx context.Context, req *LoadBalanceRequest) (*LoadBalanceResult, error)

	// Review analytics
	GetReviewMetrics(ctx context.Context, req *ReviewMetricsRequest) (*ReviewMetrics, error)
	GetReviewTrends(ctx context.Context, tenantID string, timeRange *TimestampRange) (*ReviewTrends, error)
	GetReviewerPerformance(ctx context.Context, reviewerID string, timeRange *TimestampRange) (*ReviewerPerformance, error)
}

// CIPipelineInterface defines CI/CD pipeline operations
type CIPipelineInterface interface {
	// Pipeline management
	CreatePipelineTemplate(ctx context.Context, req *CreatePipelineTemplateRequest) (*PipelineTemplate, error)
	GetPipelineTemplate(ctx context.Context, templateID string) (*PipelineTemplate, error)
	ListPipelineTemplates(ctx context.Context, opts *ListOptions) (*PaginatedResponse[PipelineTemplate], error)
	UpdatePipelineTemplate(ctx context.Context, templateID string, req *UpdatePipelineTemplateRequest) (*PipelineTemplate, error)
	DeletePipelineTemplate(ctx context.Context, templateID string) error

	// Pipeline execution
	ExecutePipeline(ctx context.Context, req *ExecutePipelineRequest) (*PipelineExecution, error)
	RerunPipeline(ctx context.Context, executionID string, fromStage string) (*PipelineExecution, error)
	PausePipeline(ctx context.Context, executionID string) error
	ResumePipeline(ctx context.Context, executionID string) error
	ApproveStage(ctx context.Context, executionID, stageID string, approver string, comment string) error

	// Pipeline monitoring
	GetPipelineStatus(ctx context.Context, executionID string) (*PipelineStatus, error)
	GetPipelineLogs(ctx context.Context, executionID string, stage string, opts *LogOptions) (*PipelineLogs, error)
	GetPipelineMetrics(ctx context.Context, executionID string) (*PipelineMetrics, error)

	// Pipeline optimization
	OptimizePipeline(ctx context.Context, pipelineID string) (*PipelineOptimization, error)
	GetBottlenecks(ctx context.Context, pipelineID string, timeRange *TimestampRange) ([]PipelineBottleneck, error)
	SuggestOptimizations(ctx context.Context, pipelineID string) ([]PipelineOptimizationSuggestion, error)
}

// PerformanceBenchmarkingInterface defines performance benchmarking operations
type PerformanceBenchmarkingInterface interface {
	// Benchmark execution
	RunLoadTest(ctx context.Context, req *LoadTestRequest) (*LoadTestResult, error)
	RunStressTest(ctx context.Context, req *StressTestRequest) (*StressTestResult, error)
	RunSpikeTest(ctx context.Context, req *SpikeTestRequest) (*SpikeTestResult, error)
	RunSoakTest(ctx context.Context, req *SoakTestRequest) (*SoakTestResult, error)
	RunAPITest(ctx context.Context, req *APITestRequest) (*APITestResult, error)

	// Benchmark comparison
	CompareResults(ctx context.Context, req *BenchmarkCompareRequest) (*BenchmarkComparison, error)
	GetPerformanceTrends(ctx context.Context, entityID string, timeRange *TimestampRange) (*PerformanceTrends, error)
	BaselinePerformance(ctx context.Context, req *BaselineRequest) (*PerformanceBaseline, error)
	DetectRegression(ctx context.Context, req *RegressionDetectionRequest) (*RegressionResult, error)

	// Performance profiling
	ProfilePerformance(ctx context.Context, req *PerformanceProfileRequest) (*PerformanceProfile, error)
	GetFlamegraph(ctx context.Context, profileID string) (*Flamegraph, error)
	GetTrace(ctx context.Context, traceID string) (*PerformanceTrace, error)
	AnalyzeBottlenecks(ctx context.Context, req *BottleneckAnalysisRequest) (*BottleneckAnalysis, error)

	// Performance alerts
	CreatePerformanceAlert(ctx context.Context, req *CreatePerformanceAlertRequest) (*PerformanceAlert, error)
	GetPerformanceAlert(ctx context.Context, alertID string) (*PerformanceAlert, error)
	ListPerformanceAlerts(ctx context.Context, opts *ListOptions) (*PaginatedResponse[PerformanceAlert], error)
	UpdatePerformanceAlert(ctx context.Context, alertID string, req *UpdatePerformanceAlertRequest) (*PerformanceAlert, error)
	DeletePerformanceAlert(ctx context.Context, alertID string) error
}

// QualityMetricsInterface defines quality metrics operations
type QualityMetricsInterface interface {
	// Metrics collection
	CollectMetrics(ctx context.Context, req *CollectMetricsRequest) (*MetricsCollection, error)
	GetMetric(ctx context.Context, metricID string) (*QualityMetric, error)
	ListMetrics(ctx context.Context, opts *MetricsListOptions) (*PaginatedResponse[QualityMetric], error)
	GetMetricHistory(ctx context.Context, metricID string, timeRange *TimestampRange) (*MetricHistory, error)

	// Metrics aggregation
	AggregateMetrics(ctx context.Context, req *AggregateMetricsRequest) (*AggregatedMetrics, error)
	CalculateQualityScore(ctx context.Context, req *QualityScoreRequest) (*QualityScore, error)
	GetQualityIndex(ctx context.Context, entityID string, entityType string) (*QualityIndex, error)

	// Metrics visualization
	CreateDashboard(ctx context.Context, req *CreateQualityDashboardRequest) (*QualityDashboard, error)
	GetQualityDashboard(ctx context.Context, dashboardID string) (*QualityDashboard, error)
	ListQualityDashboards(ctx context.Context, opts *ListOptions) (*PaginatedResponse[QualityDashboard], error)
	UpdateQualityDashboard(ctx context.Context, dashboardID string, req *UpdateQualityDashboardRequest) (*QualityDashboard, error)
	DeleteQualityDashboard(ctx context.Context, dashboardID string) error

	// Metrics alerts
	CreateMetricAlert(ctx context.Context, req *CreateMetricAlertRequest) (*MetricAlert, error)
	GetMetricAlert(ctx context.Context, alertID string) (*MetricAlert, error)
	ListMetricAlerts(ctx context.Context, opts *ListOptions) (*PaginatedResponse[MetricAlert], error)
	UpdateMetricAlert(ctx context.Context, alertID string, req *UpdateMetricAlertRequest) (*MetricAlert, error)
	DeleteMetricAlert(ctx context.Context, alertID string) error
}

// ComplianceValidationInterface defines compliance validation operations
type ComplianceValidationInterface interface {
	// Compliance scanning
	ScanForCompliance(ctx context.Context, req *ComplianceScanRequest) (*ComplianceScanResult, error)
	ValidateControls(ctx context.Context, req *ControlValidationRequest) (*ControlValidationResult, error)
	AuditCompliance(ctx context.Context, req *ComplianceAuditRequest) (*ComplianceAuditResult, error)
	AssessRisk(ctx context.Context, req *RiskAssessmentRequest) (*RiskAssessmentResult, error)

	// Policy management
	CreateCompliancePolicy(ctx context.Context, req *CreateCompliancePolicyRequest) (*CompliancePolicy, error)
	GetCompliancePolicy(ctx context.Context, policyID string) (*CompliancePolicy, error)
	ListCompliancePolicies(ctx context.Context, opts *ListOptions) (*PaginatedResponse[CompliancePolicy], error)
	UpdateCompliancePolicy(ctx context.Context, policyID string, req *UpdateCompliancePolicyRequest) (*CompliancePolicy, error)
	DeleteCompliancePolicy(ctx context.Context, policyID string) error

	// Evidence collection
	CollectEvidence(ctx context.Context, req *EvidenceCollectionRequest) (*EvidenceCollection, error)
	ValidateEvidence(ctx context.Context, req *EvidenceValidationRequest) (*EvidenceValidationResult, error)
	GetEvidence(ctx context.Context, evidenceID string) (*ComplianceEvidence, error)
	ListEvidence(ctx context.Context, opts *EvidenceListOptions) (*PaginatedResponse[ComplianceEvidence], error)

	// Compliance reporting
	GenerateComplianceReport(ctx context.Context, req *GenerateComplianceReportRequest) (*ComplianceReport, error)
	GetComplianceReport(ctx context.Context, reportID string) (*ComplianceReport, error)
	ListComplianceReports(ctx context.Context, opts *ListOptions) (*PaginatedResponse[ComplianceReport], error)
	ExportReport(ctx context.Context, reportID string, format string) ([]byte, error)
}

// QualityGateInterface defines quality gate operations
type QualityGateInterface interface {
	// Gate management
	CreateGate(ctx context.Context, req *CreateGateRequest) (*QualityGate, error)
	GetGate(ctx context.Context, gateID string) (*QualityGate, error)
	ListGates(ctx context.Context, opts *ListOptions) (*PaginatedResponse[QualityGate], error)
	UpdateGate(ctx context.Context, gateID string, req *UpdateGateRequest) (*QualityGate, error)
	DeleteGate(ctx context.Context, gateID string) error

	// Gate evaluation
	EvaluateGate(ctx context.Context, req *EvaluateGateRequest) (*GateEvaluation, error)
	EvaluateGateForPR(ctx context.Context, repoID, prID string) (*GateEvaluation, error)
	EvaluateGateForBuild(ctx context.Context, buildID string) (*GateEvaluation, error)

	// Gate configuration
	ConfigureGateCriteria(ctx context.Context, gateID string, criteria []GateCriterion) error
	GetGateCriteria(ctx context.Context, gateID string) ([]GateCriterion, error)
	UpdateGateCriteria(ctx context.Context, gateID string, criteria []GateCriterion) error

	// Gate policies
	SetGatePolicy(ctx context.Context, req *SetGatePolicyRequest) error
	GetGatePolicy(ctx context.Context, entityID string, entityType string) (*GatePolicy, error)
	EnforceGatePolicy(ctx context.Context, req *EnforceGatePolicyRequest) (*PolicyEnforcementResult, error)
}
