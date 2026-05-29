package sdln

// ========================================
// Static Analysis Types
// ========================================

// CodeScanRequest represents a code scan request
type CodeScanRequest struct {
	RepositoryID string      `json:"repository_id"`
	Branch       string      `json:"branch,omitempty"`
	CommitID     string      `json:"commit_id,omitempty"`
	Files        []string    `json:"files,omitempty"`
	ScanType     string      `json:"scan_type"` // security, quality, complexity, coverage, all
	Options      ScanOptions `json:"options,omitempty"`
}

// ScanOptions represents scan configuration options
type ScanOptions struct {
	IncludeTests    bool     `json:"include_tests"`
	ExcludePatterns []string `json:"exclude_patterns"`
	MaxFileSize     int      `json:"max_file_size"`
	Timeout         int      `json:"timeout_seconds"`
	ParallelScans   int      `json:"parallel_scans"`
	Severity        []string `json:"severity"`
	Categories      []string `json:"categories"`
	CustomRules     []Rule   `json:"custom_rules,omitempty"`
}

// Rule represents a custom scanning rule
type Rule struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Language    string                 `json:"language"`
	Severity    string                 `json:"severity"`
	Category    string                 `json:"category"`
	Pattern     string                 `json:"pattern"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// CodeScanResult represents the result of a code scan
type CodeScanResult struct {
	ScanID          string           `json:"scan_id"`
	RepositoryID    string           `json:"repository_id"`
	Branch          string           `json:"branch"`
	CommitID        string           `json:"commit_id"`
	Status          string           `json:"status"` // running, completed, failed, cancelled
	StartedAt       Timestamp        `json:"started_at"`
	CompletedAt     *Timestamp       `json:"completed_at,omitempty"`
	Duration        int              `json:"duration_seconds"`
	Summary         ScanSummary      `json:"summary"`
	Issues          []Issue          `json:"issues"`
	Metrics         ScanMetrics      `json:"metrics"`
	Recommendations []Recommendation `json:"recommendations"`
}

// ScanSummary provides a summary of scan results
type ScanSummary struct {
	TotalFiles       int            `json:"total_files"`
	FilesScanned     int            `json:"files_scanned"`
	TotalIssues      int            `json:"total_issues"`
	IssuesBySeverity map[string]int `json:"issues_by_severity"`
	IssuesByCategory map[string]int `json:"issues_by_category"`
	IssuesByFile     map[string]int `json:"issues_by_file"`
	QualityScore     float64        `json:"quality_score"`
}

// Issue represents a code issue found during scanning
type Issue struct {
	ID          string                 `json:"id"`
	File        string                 `json:"file"`
	Line        int                    `json:"line"`
	Column      int                    `json:"column"`
	EndLine     int                    `json:"end_line,omitempty"`
	EndColumn   int                    `json:"end_column,omitempty"`
	Severity    string                 `json:"severity"` // critical, high, medium, low, info
	Category    string                 `json:"category"`
	Type        string                 `json:"type"`
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	Rule        string                 `json:"rule"`
	Suggestion  string                 `json:"suggestion,omitempty"`
	Effort      int                    `json:"effort_minutes,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	Cached      bool                   `json:"cached,omitempty"`
}

// ScanMetrics represents various code metrics
type ScanMetrics struct {
	CyclomaticComplexity    float64 `json:"cyclomatic_complexity"`
	CognitiveComplexity     float64 `json:"cognitive_complexity"`
	TechDebtRatio           float64 `json:"tech_debt_ratio"`
	CodeCoverage            float64 `json:"code_coverage"`
	DuplicatedLines         int     `json:"duplicated_lines"`
	DuplicatedFiles         int     `json:"duplicated_files"`
	MaintainabilityIndex    float64 `json:"maintainability_index"`
	TestCoverage            float64 `json:"test_coverage"`
	SecurityVulnerabilities int     `json:"security_vulnerabilities"`
}

// Recommendation represents an improvement recommendation
type Recommendation struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	Priority    string                 `json:"priority"`
	Impact      string                 `json:"impact"`
	Effort      string                 `json:"effort"`
	AutoFixable bool                   `json:"auto_fixable"`
	Changes     []CodeChange           `json:"changes,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// CodeChange represents a code change suggestion
type CodeChange struct {
	File     string `json:"file"`
	Line     int    `json:"line"`
	Old      string `json:"old"`
	New      string `json:"new"`
	Position string `json:"position"` // before, after, replace
}

// ScanConfig represents scan configuration
type ScanConfig struct {
	EnabledScanners   []string           `json:"enabled_scanners"`
	DefaultRules      []string           `json:"default_rules"`
	CustomRules       []Rule             `json:"custom_rules"`
	QualityGates      []QualityGate      `json:"quality_gates"`
	NotificationRules []NotificationRule `json:"notification_rules"`
	Schedule          ScanSchedule       `json:"schedule"`
	Settings          ScanSettings       `json:"settings"`
}

// NotificationRule represents a notification rule
type NotificationRule struct {
	ID       string                 `json:"id"`
	Name     string                 `json:"name"`
	Trigger  NotificationTrigger    `json:"trigger"`
	Channels []NotificationChannel  `json:"channels"`
	Template string                 `json:"template"`
	Enabled  bool                   `json:"enabled"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// NotificationTrigger defines when to trigger notifications
type NotificationTrigger struct {
	Events    []string `json:"events"`
	Severity  []string `json:"severity"`
	Category  []string `json:"category"`
	Threshold int      `json:"threshold,omitempty"`
}

// NotificationChannel defines notification channels
type NotificationChannel struct {
	Type    string                 `json:"type"` // email, slack, teams, webhook
	Config  map[string]interface{} `json:"config"`
	Enabled bool                   `json:"enabled"`
}

// ScanSchedule defines scan schedule
type ScanSchedule struct {
	Enabled   bool     `json:"enabled"`
	Frequency string   `json:"frequency"` // daily, weekly, monthly
	Time      string   `json:"time"`
	Timezone  string   `json:"timezone"`
	Days      []string `json:"days,omitempty"`
}

// ScanSettings represents scan settings
type ScanSettings struct {
	MaxScanDuration int      `json:"max_scan_duration_seconds"`
	MaxFileSize     int      `json:"max_file_size_mb"`
	ExcludePaths    []string `json:"exclude_paths"`
	IncludeTests    bool     `json:"include_tests"`
	ParallelScans   int      `json:"parallel_scans"`
	RetentionDays   int      `json:"retention_days"`
}

// ========================================
// Code Review Types
// ========================================

// CreateReviewRequest represents a create review request
type CreateReviewRequest struct {
	Title        string                 `json:"title"`
	Description  string                 `json:"description"`
	Author       string                 `json:"author"`
	Reviewers    []string               `json:"reviewers"`
	RepositoryID string                 `json:"repository_id"`
	Branch       string                 `json:"branch"`
	CommitID     string                 `json:"commit_id"`
	Files        []ReviewFile           `json:"files"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// ReviewFile represents a file in review
type ReviewFile struct {
	Path         string `json:"path"`
	ChangeType   string `json:"change_type"` // added, modified, deleted, renamed
	AddedLines   int    `json:"added_lines"`
	DeletedLines int    `json:"deleted_lines"`
	Diff         string `json:"diff,omitempty"`
}

// CodeReview represents a code review
type CodeReview struct {
	ID           string                 `json:"id"`
	Title        string                 `json:"title"`
	Description  string                 `json:"description"`
	Status       string                 `json:"status"` // pending, in_review, approved, rejected, merged, closed
	Author       string                 `json:"author"`
	Reviewers    []Reviewer             `json:"reviewers"`
	RepositoryID string                 `json:"repository_id"`
	Branch       string                 `json:"branch"`
	CommitID     string                 `json:"commit_id"`
	Files        []ReviewFile           `json:"files"`
	Comments     []ReviewComment        `json:"comments"`
	Checks       []ReviewCheck          `json:"checks"`
	CreatedAt    Timestamp              `json:"created_at"`
	UpdatedAt    Timestamp              `json:"updated_at"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// Reviewer represents a reviewer
type Reviewer struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	Email      string     `json:"email"`
	Status     string     `json:"status"` // pending, approved, rejected
	Decision   string     `json:"decision,omitempty"`
	Comment    string     `json:"comment,omitempty"`
	ReviewedAt *Timestamp `json:"reviewed_at,omitempty"`
}

// ReviewComment represents a review comment
type ReviewComment struct {
	ID         string                 `json:"id"`
	Author     string                 `json:"author"`
	File       string                 `json:"file,omitempty"`
	Line       int                    `json:"line,omitempty"`
	Content    string                 `json:"content"`
	Type       string                 `json:"type"` // general, suggestion, issue, approval
	Resolved   bool                   `json:"resolved"`
	ResolvedBy string                 `json:"resolved_by,omitempty"`
	CreatedAt  Timestamp              `json:"created_at"`
	UpdatedAt  Timestamp              `json:"updated_at"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

// ReviewCheck represents an automated check
type ReviewCheck struct {
	Name        string     `json:"name"`
	Status      string     `json:"status"` // pending, passed, failed, skipped
	Description string     `json:"description"`
	Details     string     `json:"details,omitempty"`
	URL         string     `json:"url,omitempty"`
	StartedAt   Timestamp  `json:"started_at"`
	CompletedAt *Timestamp `json:"completed_at,omitempty"`
}

// UpdateReviewRequest represents an update review request
type UpdateReviewRequest struct {
	Title           *string                `json:"title,omitempty"`
	Description     *string                `json:"description,omitempty"`
	Status          *string                `json:"status,omitempty"`
	Reviewers       []string               `json:"reviewers,omitempty"`
	AddReviewers    []string               `json:"add_reviewers,omitempty"`
	RemoveReviewers []string               `json:"remove_reviewers,omitempty"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
}

// ReviewListOptions represents review list options
type ReviewListOptions struct {
	ListOptions
	Status       []string   `json:"status,omitempty"`
	Author       string     `json:"author,omitempty"`
	Reviewer     string     `json:"reviewer,omitempty"`
	RepositoryID string     `json:"repository_id,omitempty"`
	Branch       string     `json:"branch,omitempty"`
	DateFrom     *Timestamp `json:"date_from,omitempty"`
	DateTo       *Timestamp `json:"date_to,omitempty"`
}

// AutoReviewRequest represents an auto review request
type AutoReviewRequest struct {
	RepositoryID string            `json:"repository_id"`
	CommitID     string            `json:"commit_id"`
	Files        []string          `json:"files,omitempty"`
	Checks       []string          `json:"checks,omitempty"`
	Options      AutoReviewOptions `json:"options,omitempty"`
}

// AutoReviewOptions represents auto review options
type AutoReviewOptions struct {
	AnalyzeSecurity        bool `json:"analyze_security"`
	AnalyzePerformance     bool `json:"analyze_performance"`
	AnalyzeMaintainability bool `json:"analyze_maintainability"`
	AnalyzeTesting         bool `json:"analyze_testing"`
	SuggestImprovements    bool `json:"suggest_improvements"`
	GenerateComments       bool `json:"generate_comments"`
}

// AutoReviewResult represents auto review results
type AutoReviewResult struct {
	ReviewID    string                 `json:"review_id"`
	Status      string                 `json:"status"`
	Summary     AutoReviewSummary      `json:"summary"`
	Comments    []ReviewComment        `json:"comments"`
	Checks      []ReviewCheck          `json:"checks"`
	Suggestions []AutoReviewSuggestion `json:"suggestions"`
	GeneratedAt Timestamp              `json:"generated_at"`
}

// AutoReviewSummary represents auto review summary
type AutoReviewSummary struct {
	TotalIssues      int            `json:"total_issues"`
	IssuesBySeverity map[string]int `json:"issues_by_severity"`
	IssuesByCategory map[string]int `json:"issues_by_category"`
	QualityScore     float64        `json:"quality_score"`
	Recommendations  []string       `json:"recommendations"`
}

// AutoReviewSuggestion represents an auto review suggestion
type AutoReviewSuggestion struct {
	Type        string     `json:"type"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	File        string     `json:"file"`
	Line        int        `json:"line"`
	Change      CodeChange `json:"change"`
	Priority    string     `json:"priority"`
}

// ========================================
// CI/CD Pipeline Types
// ========================================

// CreatePipelineRequest represents a create pipeline request
type CreatePipelineRequest struct {
	Name         string              `json:"name"`
	Description  string              `json:"description"`
	RepositoryID string              `json:"repository_id"`
	TemplateID   string              `json:"template_id,omitempty"`
	Triggers     []PipelineTrigger   `json:"triggers"`
	Stages       []PipelineStage     `json:"stages"`
	Environment  PipelineEnvironment `json:"environment"`
	Settings     PipelineSettings    `json:"settings"`
}

// PipelineTrigger represents a pipeline trigger
type PipelineTrigger struct {
	Type     string                 `json:"type"` // push, pull_request, schedule, manual
	Event    string                 `json:"event"`
	Branches []string               `json:"branches,omitempty"`
	Paths    []string               `json:"paths,omitempty"`
	Schedule string                 `json:"schedule,omitempty"`
	Config   map[string]interface{} `json:"config,omitempty"`
}

// PipelineStage represents a pipeline stage
type PipelineStage struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Type        string            `json:"type"` // build, test, deploy, security, quality
	Steps       []PipelineStep    `json:"steps"`
	DependsOn   []string          `json:"depends_on,omitempty"`
	Condition   string            `json:"condition,omitempty"`
	Timeout     int               `json:"timeout_seconds"`
	Approvals   []Approval        `json:"approvals,omitempty"`
	Environment map[string]string `json:"environment,omitempty"`
}

// PipelineStep represents a pipeline step
type PipelineStep struct {
	ID              string                 `json:"id"`
	Name            string                 `json:"name"`
	Type            string                 `json:"type"` // script, action, plugin
	Command         string                 `json:"command,omitempty"`
	Image           string                 `json:"image,omitempty"`
	Script          []string               `json:"script,omitempty"`
	Inputs          map[string]interface{} `json:"inputs,omitempty"`
	Outputs         map[string]interface{} `json:"outputs,omitempty"`
	Condition       string                 `json:"condition,omitempty"`
	ContinueOnError bool                   `json:"continue_on_error"`
	Timeout         int                    `json:"timeout_seconds"`
	Retries         int                    `json:"retries"`
}

// Approval represents an approval requirement
type Approval struct {
	Type      string   `json:"type"` // user, group, external
	Required  int      `json:"required"`
	Approvers []string `json:"approvers"`
	Timeout   int      `json:"timeout_minutes"`
}

// PipelineEnvironment represents pipeline environment
type PipelineEnvironment struct {
	Name      string            `json:"name"`
	Type      string            `json:"type"` // development, staging, production
	Variables map[string]string `json:"variables"`
	Secrets   map[string]string `json:"secrets"`
	Provider  string            `json:"provider"` // aws, gcp, azure, cloudflare
	Region    string            `json:"region"`
	Cluster   string            `json:"cluster,omitempty"`
	Namespace string            `json:"namespace,omitempty"`
}

// PipelineSettings represents pipeline settings
type PipelineSettings struct {
	AutoCancel  bool       `json:"auto_cancel"`
	Timeout     int        `json:"timeout_minutes"`
	RetryOnFail bool       `json:"retry_on_fail"`
	MaxRetries  int        `json:"max_retries"`
	NotifyOn    []string   `json:"notify_on"` // success, failure, always
	Artifacts   []Artifact `json:"artifacts"`
	Cache       []Cache    `json:"cache"`
	Resources   Resources  `json:"resources"`
}

// Artifact represents pipeline artifact
type Artifact struct {
	Name     string `json:"name"`
	Path     string `json:"path"`
	Expiry   int    `json:"expiry_days"`
	ExpireIn string `json:"expire_in,omitempty"`
	Public   bool   `json:"public"`
}

// Cache represents pipeline cache
type Cache struct {
	Path  string `json:"path"`
	Key   string `json:"key"`
	Scope string `json:"scope"` // pipeline, branch, job
}

// Resources represents pipeline resources
type Resources struct {
	CPU    string `json:"cpu"`
	Memory string `json:"memory"`
	Disk   string `json:"disk"`
	GPU    string `json:"gpu,omitempty"`
}

// Pipeline represents a CI/CD pipeline
type Pipeline struct {
	ID           string              `json:"id"`
	Name         string              `json:"name"`
	Description  string              `json:"description"`
	RepositoryID string              `json:"repository_id"`
	Triggers     []PipelineTrigger   `json:"triggers"`
	Stages       []PipelineStage     `json:"stages"`
	Environment  PipelineEnvironment `json:"environment"`
	Settings     PipelineSettings    `json:"settings"`
	Status       string              `json:"status"` // active, inactive, archived
	CreatedAt    Timestamp           `json:"created_at"`
	UpdatedAt    Timestamp           `json:"updated_at"`
	CreatedBy    string              `json:"created_by"`
	UpdatedBy    string              `json:"updated_by"`
}

// UpdatePipelineRequest represents an update pipeline request
type UpdatePipelineRequest struct {
	Name        *string              `json:"name,omitempty"`
	Description *string              `json:"description,omitempty"`
	Triggers    []PipelineTrigger    `json:"triggers,omitempty"`
	Stages      []PipelineStage      `json:"stages,omitempty"`
	Environment *PipelineEnvironment `json:"environment,omitempty"`
	Settings    *PipelineSettings    `json:"settings,omitempty"`
	Status      *string              `json:"status,omitempty"`
}

// TriggerRequest represents a trigger request
type TriggerRequest struct {
	Branch      string                 `json:"branch"`
	CommitID    string                 `json:"commit_id"`
	Parameters  map[string]interface{} `json:"parameters,omitempty"`
	TriggeredBy string                 `json:"triggered_by"`
}

// PipelineExecution represents a pipeline execution
type PipelineExecution struct {
	ID          string                 `json:"id"`
	PipelineID  string                 `json:"pipeline_id"`
	Status      string                 `json:"status"` // pending, running, success, failure, cancelled, skipped
	Branch      string                 `json:"branch"`
	CommitID    string                 `json:"commit_id"`
	Trigger     string                 `json:"trigger"`
	TriggeredBy string                 `json:"triggered_by"`
	Stages      []StageExecution       `json:"stages"`
	Artifacts   []ExecutionArtifact    `json:"artifacts"`
	Variables   map[string]string      `json:"variables"`
	StartedAt   Timestamp              `json:"started_at"`
	CompletedAt *Timestamp             `json:"completed_at,omitempty"`
	Duration    int                    `json:"duration_seconds"`
	URL         string                 `json:"url,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// StageExecution represents a stage execution
type StageExecution struct {
	ID          string              `json:"id"`
	StageID     string              `json:"stage_id"`
	Name        string              `json:"name"`
	Status      string              `json:"status"`
	Steps       []StepExecution     `json:"steps"`
	Approvals   []ApprovalExecution `json:"approvals,omitempty"`
	StartedAt   Timestamp           `json:"started_at"`
	CompletedAt *Timestamp          `json:"completed_at,omitempty"`
	Duration    int                 `json:"duration_seconds"`
}

// StepExecution represents a step execution
type StepExecution struct {
	ID          string              `json:"id"`
	StepID      string              `json:"step_id"`
	Name        string              `json:"name"`
	Status      string              `json:"status"`
	Command     string              `json:"command,omitempty"`
	ExitCode    int                 `json:"exit_code,omitempty"`
	Output      string              `json:"output,omitempty"`
	Error       string              `json:"error,omitempty"`
	Logs        []LogEntry          `json:"logs,omitempty"`
	Artifacts   []ExecutionArtifact `json:"artifacts,omitempty"`
	StartedAt   Timestamp           `json:"started_at"`
	CompletedAt *Timestamp          `json:"completed_at,omitempty"`
	Duration    int                 `json:"duration_seconds"`
	Retries     int                 `json:"retries"`
}

// ApprovalExecution represents an approval execution
type ApprovalExecution struct {
	ID          string     `json:"id"`
	Type        string     `json:"type"`
	Status      string     `json:"status"`
	Required    int        `json:"required"`
	Received    int        `json:"received"`
	Approvers   []Approver `json:"approvers"`
	StartedAt   Timestamp  `json:"started_at"`
	CompletedAt *Timestamp `json:"completed_at,omitempty"`
	Timeout     int        `json:"timeout_minutes"`
}

// Approver represents an approver
type Approver struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	Status     string     `json:"status"`
	Comment    string     `json:"comment,omitempty"`
	ApprovedAt *Timestamp `json:"approved_at,omitempty"`
}

// LogEntry represents a log entry
type LogEntry struct {
	Timestamp Timestamp `json:"timestamp"`
	Level     string    `json:"level"` // debug, info, warn, error
	Message   string    `json:"message"`
	Source    string    `json:"source,omitempty"`
}

// ExecutionArtifact represents an execution artifact
type ExecutionArtifact struct {
	Name     string    `json:"name"`
	Path     string    `json:"path"`
	Type     string    `json:"type"` // file, directory, url
	Size     int64     `json:"size"`
	Checksum string    `json:"checksum,omitempty"`
	URL      string    `json:"url,omitempty"`
	Expires  Timestamp `json:"expires,omitempty"`
}

// ========================================
// Performance Benchmarking Types
// ========================================

// CreateBenchmarkRequest represents a create benchmark request
type CreateBenchmarkRequest struct {
	Name        string              `json:"name"`
	Description string              `json:"description"`
	Type        string              `json:"type"` // load, stress, spike, soak, api
	Target      BenchmarkTarget     `json:"target"`
	Scenario    BenchmarkScenario   `json:"scenario"`
	Thresholds  BenchmarkThresholds `json:"thresholds"`
	Schedule    BenchmarkSchedule   `json:"schedule,omitempty"`
	Settings    BenchmarkSettings   `json:"settings"`
}

// BenchmarkTarget represents a benchmark target
type BenchmarkTarget struct {
	Type    string                 `json:"type"` // url, api, service, application
	URL     string                 `json:"url"`
	Method  string                 `json:"method,omitempty"`
	Headers map[string]string      `json:"headers,omitempty"`
	Body    string                 `json:"body,omitempty"`
	Config  map[string]interface{} `json:"config,omitempty"`
}

// BenchmarkScenario represents a benchmark scenario
type BenchmarkScenario struct {
	Users     int                 `json:"users"`
	Duration  int                 `json:"duration_seconds"`
	RampUp    int                 `json:"ramp_up_seconds"`
	RampDown  int                 `json:"ramp_down_seconds"`
	ThinkTime int                 `json:"think_time_ms"`
	Phases    []ScenarioPhase     `json:"phases,omitempty"`
	Requests  []RequestDefinition `json:"requests,omitempty"`
	Workload  WorkloadDefinition  `json:"workload,omitempty"`
}

// ScenarioPhase represents a scenario phase
type ScenarioPhase struct {
	Name     string `json:"name"`
	Users    int    `json:"users"`
	Duration int    `json:"duration_seconds"`
	RampUp   int    `json:"ramp_up_seconds"`
}

// RequestDefinition represents a request definition
type RequestDefinition struct {
	Name      string                 `json:"name"`
	Method    string                 `json:"method"`
	URL       string                 `json:"url"`
	Headers   map[string]string      `json:"headers,omitempty"`
	Body      string                 `json:"body,omitempty"`
	Weight    int                    `json:"weight"`
	ThinkTime int                    `json:"think_time_ms"`
	Config    map[string]interface{} `json:"config,omitempty"`
}

// WorkloadDefinition represents a workload definition
type WorkloadDefinition struct {
	Type       string                 `json:"type"` // constant, spike, step, custom
	Profile    string                 `json:"profile"`
	Parameters map[string]interface{} `json:"parameters,omitempty"`
}

// BenchmarkThresholds represents benchmark thresholds
type BenchmarkThresholds struct {
	ResponseTime    int                `json:"response_time_ms"`
	ResponseTimeP95 int                `json:"response_time_p95_ms"`
	ResponseTimeP99 int                `json:"response_time_p99_ms"`
	Throughput      int                `json:"throughput_rps"`
	ErrorRate       float64            `json:"error_rate_percent"`
	CPU             float64            `json:"cpu_percent"`
	Memory          float64            `json:"memory_percent"`
	Custom          map[string]float64 `json:"custom,omitempty"`
}

// BenchmarkSchedule represents benchmark schedule
type BenchmarkSchedule struct {
	Enabled   bool     `json:"enabled"`
	Frequency string   `json:"frequency"` // hourly, daily, weekly, monthly
	Time      string   `json:"time"`
	Timezone  string   `json:"timezone"`
	Days      []string `json:"days,omitempty"`
}

// BenchmarkSettings represents benchmark settings
type BenchmarkSettings struct {
	Locations   []string `json:"locations"`
	Engine      string   `json:"engine"` // k6, artillery, jmeter, gatling
	Distributed bool     `json:"distributed"`
	Workers     int      `json:"workers"`
	Timeout     int      `json:"timeout_seconds"`
	KeepAlive   bool     `json:"keep_alive"`
	IgnoreSSL   bool     `json:"ignore_ssl"`
	UserAgent   string   `json:"user_agent,omitempty"`
}

// Benchmark represents a performance benchmark
type Benchmark struct {
	ID          string              `json:"id"`
	Name        string              `json:"name"`
	Description string              `json:"description"`
	Type        string              `json:"type"`
	Target      BenchmarkTarget     `json:"target"`
	Scenario    BenchmarkScenario   `json:"scenario"`
	Thresholds  BenchmarkThresholds `json:"thresholds"`
	Schedule    BenchmarkSchedule   `json:"schedule"`
	Settings    BenchmarkSettings   `json:"settings"`
	Status      string              `json:"status"` // active, inactive, archived
	CreatedAt   Timestamp           `json:"created_at"`
	UpdatedAt   Timestamp           `json:"updated_at"`
	CreatedBy   string              `json:"created_by"`
	UpdatedBy   string              `json:"updated_by"`
}

// BenchmarkConfig represents runtime benchmark configuration
type BenchmarkConfig struct {
	Environment string                 `json:"environment"`
	Variables   map[string]interface{} `json:"variables"`
	Overrides   map[string]interface{} `json:"overrides,omitempty"`
	Debug       bool                   `json:"debug"`
	DryRun      bool                   `json:"dry_run"`
}

// BenchmarkResult represents a benchmark execution result
type BenchmarkResult struct {
	ID          string           `json:"id"`
	BenchmarkID string           `json:"benchmark_id"`
	Status      string           `json:"status"`
	Config      BenchmarkConfig  `json:"config"`
	Summary     BenchmarkSummary `json:"summary"`
	Metrics     BenchmarkMetrics `json:"metrics"`
	Charts      []BenchmarkChart `json:"charts,omitempty"`
	Thresholds  ThresholdResults `json:"thresholds"`
	Artifacts   []ResultArtifact `json:"artifacts,omitempty"`
	StartedAt   Timestamp        `json:"started_at"`
	CompletedAt *Timestamp       `json:"completed_at,omitempty"`
	Duration    int              `json:"duration_seconds"`
	ExecutedBy  string           `json:"executed_by"`
}

// BenchmarkSummary represents benchmark summary
type BenchmarkSummary struct {
	TotalRequests      int     `json:"total_requests"`
	SuccessfulRequests int     `json:"successful_requests"`
	FailedRequests     int     `json:"failed_requests"`
	ErrorRate          float64 `json:"error_rate_percent"`
	AvgResponseTime    int     `json:"avg_response_time_ms"`
	P50ResponseTime    int     `json:"p50_response_time_ms"`
	P90ResponseTime    int     `json:"p90_response_time_ms"`
	P95ResponseTime    int     `json:"p95_response_time_ms"`
	P99ResponseTime    int     `json:"p99_response_time_ms"`
	Throughput         float64 `json:"throughput_rps"`
	PeakThroughput     float64 `json:"peak_throughput_rps"`
	MinThroughput      float64 `json:"min_throughput_rps"`
}

// BenchmarkMetrics represents detailed benchmark metrics
type BenchmarkMetrics struct {
	Throughput      []MetricPoint            `json:"throughput"`
	ResponseTime    []MetricPoint            `json:"response_time"`
	ErrorRate       []MetricPoint            `json:"error_rate"`
	CPU             []MetricPoint            `json:"cpu"`
	Memory          []MetricPoint            `json:"memory"`
	Network         []MetricPoint            `json:"network"`
	CustomMetrics   map[string][]MetricPoint `json:"custom_metrics,omitempty"`
	Errors          []ErrorDetail            `json:"errors,omitempty"`
	SlowestRequests []RequestDetail          `json:"slowest_requests,omitempty"`
	FastestRequests []RequestDetail          `json:"fastest_requests,omitempty"`
}

// MetricPoint represents a metric data point
type MetricPoint struct {
	Timestamp Timestamp         `json:"timestamp"`
	Value     float64           `json:"value"`
	Tags      map[string]string `json:"tags,omitempty"`
}

// ErrorDetail represents error details
type ErrorDetail struct {
	Type       string    `json:"type"`
	Message    string    `json:"message"`
	Count      int       `json:"count"`
	Percentage float64   `json:"percentage"`
	FirstSeen  Timestamp `json:"first_seen"`
	LastSeen   Timestamp `json:"last_seen"`
}

// RequestDetail represents request details
type RequestDetail struct {
	URL          string            `json:"url"`
	Method       string            `json:"method"`
	Status       int               `json:"status"`
	ResponseTime int               `json:"response_time_ms"`
	Size         int64             `json:"size_bytes"`
	Timestamp    Timestamp         `json:"timestamp"`
	Headers      map[string]string `json:"headers,omitempty"`
}

// BenchmarkChart represents a benchmark chart
type BenchmarkChart struct {
	Title       string       `json:"title"`
	Type        string       `json:"type"` // line, bar, area, scatter
	Metric      string       `json:"metric"`
	Data        []DataPoint  `json:"data"`
	Axis        ChartAxis    `json:"axis"`
	Annotations []Annotation `json:"annotations,omitempty"`
}

// DataPoint represents a chart data point
type DataPoint struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// ChartAxis represents chart axis
type ChartAxis struct {
	XAxis ChartAxisConfig `json:"x_axis"`
	YAxis ChartAxisConfig `json:"y_axis"`
}

// ChartAxisConfig represents chart axis configuration
type ChartAxisConfig struct {
	Title  string  `json:"title"`
	Min    float64 `json:"min,omitempty"`
	Max    float64 `json:"max,omitempty"`
	Format string  `json:"format,omitempty"`
}

// Annotation represents chart annotation
type Annotation struct {
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
	Text string  `json:"text"`
	Type string  `json:"type"`
}

// ThresholdResults represents threshold evaluation results
type ThresholdResults struct {
	Passed  int                   `json:"passed"`
	Failed  int                   `json:"failed"`
	Results []ThresholdEvaluation `json:"results"`
	Summary ThresholdSummary      `json:"summary"`
}

// ThresholdEvaluation represents threshold evaluation
type ThresholdEvaluation struct {
	Name       string  `json:"name"`
	Threshold  float64 `json:"threshold"`
	Actual     float64 `json:"actual"`
	Passed     bool    `json:"passed"`
	Percentage float64 `json:"percentage"`
	Unit       string  `json:"unit"`
}

// ThresholdSummary represents threshold summary
type ThresholdSummary struct {
	Score           float64  `json:"score"`
	Grade           string   `json:"grade"` // A, B, C, D, F
	Recommendations []string `json:"recommendations"`
}

// ResultArtifact represents a result artifact
type ResultArtifact struct {
	Name     string                 `json:"name"`
	Type     string                 `json:"type"` // report, log, config, video, screenshot
	Path     string                 `json:"path"`
	URL      string                 `json:"url,omitempty"`
	Size     int64                  `json:"size"`
	Checksum string                 `json:"checksum,omitempty"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// BenchmarkComparison represents benchmark comparison
type BenchmarkComparison struct {
	ID          string              `json:"id"`
	BaselineID  string              `json:"baseline_id"`
	CompareID   string              `json:"compare_id"`
	Summary     ComparisonSummary   `json:"summary"`
	Metrics     ComparisonMetrics   `json:"metrics"`
	Insights    []ComparisonInsight `json:"insights"`
	GeneratedAt Timestamp           `json:"generated_at"`
}

// ComparisonSummary represents comparison summary
type ComparisonSummary struct {
	OverallImprovement float64 `json:"overall_improvement_percent"`
	ThroughputChange   float64 `json:"throughput_change_percent"`
	ResponseTimeChange float64 `json:"response_time_change_percent"`
	ErrorRateChange    float64 `json:"error_rate_change_percent"`
	ResourceChange     float64 `json:"resource_change_percent"`
	Grade              string  `json:"grade"`
}

// ComparisonMetrics represents comparison metrics
type ComparisonMetrics struct {
	Throughput    MetricComparison            `json:"throughput"`
	ResponseTime  MetricComparison            `json:"response_time"`
	ErrorRate     MetricComparison            `json:"error_rate"`
	CPU           MetricComparison            `json:"cpu"`
	Memory        MetricComparison            `json:"memory"`
	CustomMetrics map[string]MetricComparison `json:"custom_metrics,omitempty"`
}

// MetricComparison represents metric comparison
type MetricComparison struct {
	Baseline float64 `json:"baseline"`
	Compare  float64 `json:"compare"`
	Change   float64 `json:"change_percent"`
	Trend    string  `json:"trend"` // improved, degraded, stable
}

// ComparisonInsight represents comparison insight
type ComparisonInsight struct {
	Type           string   `json:"type"`     // improvement, regression, anomaly
	Severity       string   `json:"severity"` // critical, high, medium, low
	Title          string   `json:"title"`
	Description    string   `json:"description"`
	Impact         string   `json:"impact"`
	Recommendation string   `json:"recommendation"`
	Metrics        []string `json:"metrics"`
}

// ========================================
// Quality Metrics Types
// ========================================

// QualityMetrics represents quality metrics
type QualityMetrics struct {
	TenantID     string                     `json:"tenant_id"`
	TimeRange    TimestampRange             `json:"time_range"`
	OverallScore float64                    `json:"overall_score"`
	Categories   map[string]QualityCategory `json:"categories"`
	Trends       QualityTrends              `json:"trends"`
	Benchmarks   QualityBenchmarks          `json:"benchmarks"`
	GeneratedAt  Timestamp                  `json:"generated_at"`
}

// QualityCategory represents quality category metrics
type QualityCategory struct {
	Name    string             `json:"name"`
	Score   float64            `json:"score"`
	Weight  float64            `json:"weight"`
	Metrics map[string]float64 `json:"metrics"`
	Status  string             `json:"status"` // excellent, good, fair, poor
	Trend   string             `json:"trend"`  // improving, stable, declining
}

// QualityTrends represents quality trends
type QualityTrends struct {
	Daily   []TrendPoint `json:"daily"`
	Weekly  []TrendPoint `json:"weekly"`
	Monthly []TrendPoint `json:"monthly"`
}

// TrendPoint represents a trend data point
type TrendPoint struct {
	Date  Timestamp `json:"date"`
	Score float64   `json:"score"`
}

// QualityBenchmarks represents quality benchmarks
type QualityBenchmarks struct {
	Industry   float64 `json:"industry"`
	Internal   float64 `json:"internal"`
	Target     float64 `json:"target"`
	Percentile int     `json:"percentile"`
}

// QualityScore represents a quality score
type QualityScore struct {
	EntityID     string                 `json:"entity_id"`
	EntityType   string                 `json:"entity_type"`
	OverallScore float64                `json:"overall_score"`
	Categories   map[string]float64     `json:"categories"`
	Factors      map[string]float64     `json:"factors"`
	LastUpdated  Timestamp              `json:"last_updated"`
	ValidUntil   Timestamp              `json:"valid_until"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// CollectMetricsRequest represents a collect metrics request
type CollectMetricsRequest struct {
	Source    string             `json:"source"`
	Metrics   []MetricDefinition `json:"metrics"`
	TimeRange TimestampRange     `json:"time_range"`
	Options   CollectOptions     `json:"options,omitempty"`
}

// MetricDefinition represents a metric definition
type MetricDefinition struct {
	Name        string            `json:"name"`
	Type        string            `json:"type"` // counter, gauge, histogram, timer
	Source      string            `json:"source"`
	Query       string            `json:"query,omitempty"`
	Labels      map[string]string `json:"labels,omitempty"`
	Aggregation string            `json:"aggregation,omitempty"`
}

// CollectOptions represents collect options
type CollectOptions struct {
	Granularity string `json:"granularity"` // raw, 1m, 5m, 1h, 1d
	FillMissing bool   `json:"fill_missing"`
	Timeout     int    `json:"timeout_seconds"`
	Retries     int    `json:"retries"`
}

// MetricsCollection represents a metrics collection
type MetricsCollection struct {
	CollectionID string          `json:"collection_id"`
	Source       string          `json:"source"`
	TimeRange    TimestampRange  `json:"time_range"`
	Metrics      []QualityMetric `json:"metrics"`
	Status       string          `json:"status"`
	CollectedAt  Timestamp       `json:"collected_at"`
}

// QualityMetric represents a quality metric
type QualityMetric struct {
	ID        string                 `json:"id"`
	Name      string                 `json:"name"`
	Type      string                 `json:"type"`
	Value     float64                `json:"value"`
	Unit      string                 `json:"unit"`
	Labels    map[string]string      `json:"labels"`
	Timestamp Timestamp              `json:"timestamp"`
	Source    string                 `json:"source"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// MetricsListOptions represents metrics list options
type MetricsListOptions struct {
	ListOptions
	Type     string     `json:"type,omitempty"`
	Source   string     `json:"source,omitempty"`
	DateFrom *Timestamp `json:"date_from,omitempty"`
	DateTo   *Timestamp `json:"date_to,omitempty"`
}

// MetricHistory represents metric history
type MetricHistory struct {
	MetricID string        `json:"metric_id"`
	Points   []MetricPoint `json:"points"`
	Min      float64       `json:"min"`
	Max      float64       `json:"max"`
	Avg      float64       `json:"avg"`
	Count    int           `json:"count"`
}

// AggregateMetricsRequest represents an aggregate metrics request
type AggregateMetricsRequest struct {
	MetricIDs   []string          `json:"metric_ids"`
	Aggregation string            `json:"aggregation"` // sum, avg, min, max, count, p50, p90, p95, p99
	TimeRange   TimestampRange    `json:"time_range"`
	Granularity string            `json:"granularity"`
	GroupBy     []string          `json:"group_by,omitempty"`
	Filters     map[string]string `json:"filters,omitempty"`
}

// AggregatedMetrics represents aggregated metrics
type AggregatedMetrics struct {
	MetricName  string        `json:"metric_name"`
	Aggregation string        `json:"aggregation"`
	DataPoints  []MetricPoint `json:"data_points"`
	Total       float64       `json:"total"`
	Min         float64       `json:"min"`
	Max         float64       `json:"max"`
	Avg         float64       `json:"avg"`
	Count       int           `json:"count"`
}

// QualityScoreRequest represents a quality score request
type QualityScoreRequest struct {
	EntityID   string             `json:"entity_id"`
	EntityType string             `json:"entity_type"`
	Metrics    []MetricDefinition `json:"metrics"`
	Weights    map[string]float64 `json:"weights"`
	Benchmarks map[string]float64 `json:"benchmarks"`
	TimeRange  TimestampRange     `json:"time_range"`
	Options    ScoreOptions       `json:"options,omitempty"`
}

// ScoreOptions represents score calculation options
type ScoreOptions struct {
	Algorithm    string  `json:"algorithm"` // weighted, exponential, decay
	DecayFactor  float64 `json:"decay_factor"`
	Normalize    bool    `json:"normalize"`
	IncludeTrend bool    `json:"include_trend"`
}

// QualityIndex represents a quality index
type QualityIndex struct {
	EntityID     string                 `json:"entity_id"`
	EntityType   string                 `json:"entity_type"`
	Index        float64                `json:"index"`
	Grade        string                 `json:"grade"` // A+, A, B+, B, C+, C, D, F
	Rank         int                    `json:"rank"`
	Percentile   float64                `json:"percentile"`
	LastUpdated  Timestamp              `json:"last_updated"`
	Components   map[string]float64     `json:"components"`
	Improvements []Improvement          `json:"improvements"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// Improvement represents an improvement suggestion
type Improvement struct {
	Category    string   `json:"category"`
	Impact      float64  `json:"impact"`
	Effort      string   `json:"effort"` // low, medium, high
	Description string   `json:"description"`
	Actions     []string `json:"actions"`
	Priority    string   `json:"priority"`
}

// CreateQualityDashboardRequest represents a create dashboard request
type CreateQualityDashboardRequest struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Type        string                 `json:"type"` // overview, project, service, custom
	Layout      DashboardLayout        `json:"layout"`
	Widgets     []DashboardWidget      `json:"widgets"`
	Filters     DashboardFilters       `json:"filters"`
	Refresh     DashboardRefresh       `json:"refresh"`
	Sharing     DashboardSharing       `json:"sharing"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// DashboardLayout represents dashboard layout
type DashboardLayout struct {
	Columns int            `json:"columns"`
	Rows    int            `json:"rows"`
	Grid    []GridPosition `json:"grid"`
}

// GridPosition represents a grid position
type GridPosition struct {
	X      int `json:"x"`
	Y      int `json:"y"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

// DashboardWidget represents a dashboard widget
type DashboardWidget struct {
	ID          string        `json:"id"`
	Type        string        `json:"type"` // chart, metric, table, text
	Title       string        `json:"title"`
	Position    GridPosition  `json:"position"`
	Config      WidgetConfig  `json:"config"`
	Data        WidgetData    `json:"data"`
	Refresh     WidgetRefresh `json:"refresh"`
	Interactive bool          `json:"interactive"`
}

// WidgetConfig represents widget configuration
type WidgetConfig struct {
	Metric     string                 `json:"metric"`
	Query      string                 `json:"query,omitempty"`
	ChartType  string                 `json:"chart_type,omitempty"`
	Axis       WidgetAxis             `json:"axis,omitempty"`
	Legend     WidgetLegend           `json:"legend,omitempty"`
	Thresholds []WidgetThreshold      `json:"thresholds,omitempty"`
	Custom     map[string]interface{} `json:"custom,omitempty"`
}

// WidgetAxis represents widget axis
type WidgetAxis struct {
	X  WidgetAxisConfig `json:"x"`
	Y  WidgetAxisConfig `json:"y"`
	Y2 WidgetAxisConfig `json:"y2,omitempty"`
}

// WidgetAxisConfig represents widget axis configuration
type WidgetAxisConfig struct {
	Label    string  `json:"label"`
	Min      float64 `json:"min,omitempty"`
	Max      float64 `json:"max,omitempty"`
	Format   string  `json:"format,omitempty"`
	LogScale bool    `json:"log_scale"`
}

// WidgetLegend represents widget legend
type WidgetLegend struct {
	Position string `json:"position"` // top, bottom, left, right
	Show     bool   `json:"show"`
}

// WidgetThreshold represents widget threshold
type WidgetThreshold struct {
	Value float64 `json:"value"`
	Color string  `json:"color"`
	Label string  `json:"label"`
	Type  string  `json:"type"` // line, area
}

// WidgetData represents widget data
type WidgetData struct {
	Source     string                 `json:"source"`
	Query      string                 `json:"query"`
	RealTime   bool                   `json:"real_time"`
	Cache      int                    `json:"cache_seconds"`
	Transform  string                 `json:"transform,omitempty"`
	Parameters map[string]interface{} `json:"parameters,omitempty"`
}

// WidgetRefresh represents widget refresh configuration
type WidgetRefresh struct {
	Interval int  `json:"interval_seconds"`
	Enabled  bool `json:"enabled"`
}

// DashboardFilters represents dashboard filters
type DashboardFilters struct {
	TimeRange    TimeRangeFilter     `json:"time_range"`
	Projects     []ProjectFilter     `json:"projects"`
	Services     []ServiceFilter     `json:"services"`
	Environments []EnvironmentFilter `json:"environments"`
	Custom       []CustomFilter      `json:"custom"`
}

// TimeRangeFilter represents time range filter
type TimeRangeFilter struct {
	Default  string   `json:"default"` // 1h, 6h, 24h, 7d, 30d
	Options  []string `json:"options"`
	Editable bool     `json:"editable"`
}

// ProjectFilter represents project filter
type ProjectFilter struct {
	Default     string   `json:"default"`
	Options     []string `json:"options"`
	MultiSelect bool     `json:"multi_select"`
}

// ServiceFilter represents service filter
type ServiceFilter struct {
	Default     string   `json:"default"`
	Options     []string `json:"options"`
	MultiSelect bool     `json:"multi_select"`
}

// EnvironmentFilter represents environment filter
type EnvironmentFilter struct {
	Default     string   `json:"default"`
	Options     []string `json:"options"`
	MultiSelect bool     `json:"multi_select"`
}

// CustomFilter represents custom filter
type CustomFilter struct {
	Name    string                 `json:"name"`
	Type    string                 `json:"type"` // select, input, date
	Default interface{}            `json:"default"`
	Options []FilterOption         `json:"options,omitempty"`
	Config  map[string]interface{} `json:"config,omitempty"`
}

// FilterOption represents a filter option
type FilterOption struct {
	Label string      `json:"label"`
	Value interface{} `json:"value"`
}

// DashboardRefresh represents dashboard refresh
type DashboardRefresh struct {
	AutoRefresh bool `json:"auto_refresh"`
	Interval    int  `json:"interval_seconds"`
	Manual      bool `json:"manual"`
}

// DashboardSharing represents dashboard sharing
type DashboardSharing struct {
	Public bool          `json:"public"`
	Users  []string      `json:"users"`
	Groups []string      `json:"groups"`
	Link   string        `json:"link,omitempty"`
	Export ExportOptions `json:"export"`
}

// ExportOptions represents export options
type ExportOptions struct {
	PDF  bool `json:"pdf"`
	PNG  bool `json:"png"`
	SVG  bool `json:"svg"`
	JSON bool `json:"json"`
	CSV  bool `json:"csv"`
}

// QualityDashboard represents a quality dashboard
type QualityDashboard struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Type        string                 `json:"type"`
	Layout      DashboardLayout        `json:"layout"`
	Widgets     []DashboardWidget      `json:"widgets"`
	Filters     DashboardFilters       `json:"filters"`
	Refresh     DashboardRefresh       `json:"refresh"`
	Sharing     DashboardSharing       `json:"sharing"`
	CreatedAt   Timestamp              `json:"created_at"`
	UpdatedAt   Timestamp              `json:"updated_at"`
	CreatedBy   string                 `json:"created_by"`
	UpdatedBy   string                 `json:"updated_by"`
	Views       int                    `json:"views"`
	LastViewed  *Timestamp             `json:"last_viewed,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// UpdateQualityDashboardRequest represents update dashboard request
type UpdateQualityDashboardRequest struct {
	Name        *string           `json:"name,omitempty"`
	Description *string           `json:"description,omitempty"`
	Layout      *DashboardLayout  `json:"layout,omitempty"`
	Widgets     []DashboardWidget `json:"widgets,omitempty"`
	Filters     *DashboardFilters `json:"filters,omitempty"`
	Refresh     *DashboardRefresh `json:"refresh,omitempty"`
	Sharing     *DashboardSharing `json:"sharing,omitempty"`
}

// CreateMetricAlertRequest represents create metric alert request
type CreateMetricAlertRequest struct {
	Name          string                 `json:"name"`
	Description   string                 `json:"description"`
	Metric        string                 `json:"metric"`
	Condition     AlertCondition         `json:"condition"`
	Thresholds    []AlertThreshold       `json:"thresholds"`
	Severity      string                 `json:"severity"` // critical, warning, info
	Enabled       bool                   `json:"enabled"`
	Notifications []NotificationRule     `json:"notifications"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// AlertCondition represents alert condition
type AlertCondition struct {
	Operator string  `json:"operator"` // gt, lt, eq, ne, gte, lte, in, not_in
	Value    float64 `json:"value"`
	Duration int     `json:"duration_seconds"`
}

// AlertThreshold represents alert threshold
type AlertThreshold struct {
	Level    string  `json:"level"` // critical, warning, info
	Operator string  `json:"operator"`
	Value    float64 `json:"value"`
	Enabled  bool    `json:"enabled"`
}

// MetricAlert represents a metric alert
type MetricAlert struct {
	ID            string                 `json:"id"`
	Name          string                 `json:"name"`
	Description   string                 `json:"description"`
	Metric        string                 `json:"metric"`
	Condition     AlertCondition         `json:"condition"`
	Thresholds    []AlertThreshold       `json:"thresholds"`
	Severity      string                 `json:"severity"`
	Status        string                 `json:"status"` // active, inactive, triggered, resolved
	Enabled       bool                   `json:"enabled"`
	Notifications []NotificationRule     `json:"notifications"`
	LastTriggered *Timestamp             `json:"last_triggered,omitempty"`
	TriggerCount  int                    `json:"trigger_count"`
	CreatedAt     Timestamp              `json:"created_at"`
	UpdatedAt     Timestamp              `json:"updated_at"`
	CreatedBy     string                 `json:"created_by"`
	UpdatedBy     string                 `json:"updated_by"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// UpdateMetricAlertRequest represents update metric alert request
type UpdateMetricAlertRequest struct {
	Name          *string            `json:"name,omitempty"`
	Description   *string            `json:"description,omitempty"`
	Condition     *AlertCondition    `json:"condition,omitempty"`
	Thresholds    []AlertThreshold   `json:"thresholds,omitempty"`
	Severity      *string            `json:"severity,omitempty"`
	Enabled       *bool              `json:"enabled,omitempty"`
	Notifications []NotificationRule `json:"notifications,omitempty"`
}

// ========================================
// Compliance Validation Types
// ========================================

// ComplianceValidationRequest represents a compliance validation request
type ComplianceValidationRequest struct {
	EntityID   string                `json:"entity_id"`
	EntityType string                `json:"entity_type"` // code, infrastructure, process, data
	Standards  []string              `json:"standards"`   // GDPR, HIPAA, SOX, PCI-DSS, ISO27001, etc.
	Controls   []ControlValidation   `json:"controls"`
	Evidence   []EvidenceRequirement `json:"evidence,omitempty"`
	Options    ComplianceOptions     `json:"options,omitempty"`
}

// ControlValidation represents a control validation
type ControlValidation struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Category    string      `json:"category"`
	Type        string      `json:"type"` // preventive, detective, corrective, compensating`
	Automated   bool        `json:"automated"`
	Test        ControlTest `json:"test"`
	Frequency   string      `json:"frequency"` // continuous, daily, weekly, monthly, quarterly
}

// ControlTest represents a control test
type ControlTest struct {
	Type     string                 `json:"type"` // automated, manual, hybrid
	Query    string                 `json:"query,omitempty"`
	Script   string                 `json:"script,omitempty"`
	Expected map[string]interface{} `json:"expected"`
	Actual   map[string]interface{} `json:"actual,omitempty"`
}

// EvidenceRequirement represents evidence requirement
type EvidenceRequirement struct {
	Type        string `json:"type"` // document, screenshot, log, config, test_result
	Description string `json:"description"`
	Source      string `json:"source"`
	Format      string `json:"format"`
	Required    bool   `json:"required"`
	Retention   int    `json:"retention_days"`
}

// ComplianceOptions represents compliance validation options
type ComplianceOptions struct {
	StrictMode             bool     `json:"strict_mode"`
	IncludeRecommendations bool     `json:"include_recommendations"`
	GenerateEvidence       bool     `json:"generate_evidence"`
	NotifyStakeholders     bool     `json:"notify_stakeholders"`
	Exclusions             []string `json:"exclusions,omitempty"`
}

// ComplianceValidationResult represents compliance validation result
type ComplianceValidationResult struct {
	ValidationID    string                     `json:"validation_id"`
	EntityID        string                     `json:"entity_id"`
	EntityType      string                     `json:"entity_type"`
	Standards       []string                   `json:"standards"`
	OverallStatus   string                     `json:"overall_status"` // compliant, non_compliant, partial
	OverallScore    float64                    `json:"overall_score"`
	Results         []ControlResult            `json:"results"`
	Summary         ComplianceSummary          `json:"summary"`
	Issues          []ComplianceIssue          `json:"issues"`
	Recommendations []ComplianceRecommendation `json:"recommendations"`
	Evidence        []ComplianceEvidence       `json:"evidence"`
	ValidatedAt     Timestamp                  `json:"validated_at"`
	ExpiresAt       Timestamp                  `json:"expires_at"`
}

// ControlResult represents a control validation result
type ControlResult struct {
	ControlID  string                 `json:"control_id"`
	Name       string                 `json:"name"`
	Status     string                 `json:"status"` // pass, fail, warning, not_applicable
	Score      float64                `json:"score"`
	Details    map[string]interface{} `json:"details"`
	Evidence   []string               `json:"evidence_ids"`
	Findings   []ControlFinding       `json:"findings"`
	LastTested Timestamp              `json:"last_tested"`
	NextTest   Timestamp              `json:"next_test"`
}

// ControlFinding represents a control finding
type ControlFinding struct {
	Severity       string            `json:"severity"`
	Title          string            `json:"title"`
	Description    string            `json:"description"`
	Impact         string            `json:"impact"`
	Recommendation string            `json:"recommendation"`
	Evidence       string            `json:"evidence_id"`
	Remediation    RemediationAction `json:"remediation,omitempty"`
}

// RemediationAction represents a remediation action
type RemediationAction struct {
	Type        string    `json:"type"` // automatic, manual, process
	Description string    `json:"description"`
	Owner       string    `json:"owner"`
	DueDate     Timestamp `json:"due_date"`
	Status      string    `json:"status"` // pending, in_progress, completed, cancelled"`
}

// ComplianceSummary represents compliance summary
type ComplianceSummary struct {
	TotalControls   int                `json:"total_controls"`
	PassedControls  int                `json:"passed_controls"`
	FailedControls  int                `json:"failed_controls"`
	WarningControls int                `json:"warning_controls"`
	NATControls     int                `json:"na_controls"`
	ScoreByStandard map[string]float64 `json:"score_by_standard"`
	ScoreByCategory map[string]float64 `json:"score_by_category"`
	ComplianceRate  float64            `json:"compliance_rate"`
	RiskLevel       string             `json:"risk_level"` // low, medium, high, critical
}

// ComplianceIssue represents a compliance issue
type ComplianceIssue struct {
	ID          string                 `json:"id"`
	ControlID   string                 `json:"control_id"`
	Standard    string                 `json:"standard"`
	Category    string                 `json:"category"`
	Severity    string                 `json:"severity"`
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	Impact      string                 `json:"impact"`
	Status      string                 `json:"status"` // open, in_progress, resolved, closed
	Assignee    string                 `json:"assignee,omitempty"`
	CreatedAt   Timestamp              `json:"created_at"`
	UpdatedAt   Timestamp              `json:"updated_at"`
	DueDate     *Timestamp             `json:"due_date,omitempty"`
	ResolvedAt  *Timestamp             `json:"resolved_at,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// ComplianceRecommendation represents a compliance recommendation
type ComplianceRecommendation struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Category    string   `json:"category"`
	Priority    string   `json:"priority"` // critical, high, medium, low"
	Impact      string   `json:"impact"`
	Effort      string   `json:"effort"` // high, medium, low"
	Actions     []string `json:"actions"`
	Benefits    []string `json:"benefits"`
	Standards   []string `json:"standards"`
	Controls    []string `json:"controls"`
}

// ComplianceEvidence represents compliance evidence
type ComplianceEvidence struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Source      string                 `json:"source"`
	Format      string                 `json:"format"`
	Size        int64                  `json:"size"`
	URL         string                 `json:"url,omitempty"`
	Path        string                 `json:"path,omitempty"`
	Checksum    string                 `json:"checksum"`
	CollectedAt Timestamp              `json:"collected_at"`
	ExpiresAt   Timestamp              `json:"expires_at"`
	Controls    []string               `json:"controls"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// ComplianceStatus represents compliance status
type ComplianceStatus struct {
	EntityID       string                    `json:"entity_id"`
	EntityType     string                    `json:"entity_type"`
	OverallStatus  string                    `json:"status"`
	OverallScore   float64                   `json:"score"`
	Standards      map[string]StandardStatus `json:"standards"`
	LastAssessed   Timestamp                 `json:"last_assessed"`
	NextAssessment Timestamp                 `json:"next_assessment"`
	Issues         int                       `json:"open_issues"`
	RiskLevel      string                    `json:"risk_level"`
	Metadata       map[string]interface{}    `json:"metadata,omitempty"`
}

// StandardStatus represents standard-specific status
type StandardStatus struct {
	Name         string    `json:"name"`
	Version      string    `json:"version"`
	Status       string    `json:"status"`
	Score        float64   `json:"score"`
	Controls     int       `json:"total_controls"`
	Passed       int       `json:"passed_controls"`
	Failed       int       `json:"failed_controls"`
	LastAssessed Timestamp `json:"last_assessed"`
}

// ComplianceReportRequest represents a compliance report request
type ComplianceReportRequest struct {
	EntityIDs   []string        `json:"entity_ids,omitempty"`
	EntityTypes []string        `json:"entity_types,omitempty"`
	Standards   []string        `json:"standards"`
	TimeRange   TimestampRange  `json:"time_range"`
	Format      string          `json:"format"` // json, pdf, html, csv
	Template    string          `json:"template,omitempty"`
	Sections    []ReportSection `json:"sections,omitempty"`
	Options     ReportOptions   `json:"options,omitempty"`
}

// ReportSection represents a report section
type ReportSection struct {
	Name     string `json:"name"`
	Included bool   `json:"included"`
	Level    string `json:"level"` // summary, detailed, full
}

// ReportOptions represents report options
type ReportOptions struct {
	IncludeEvidence        bool   `json:"include_evidence"`
	IncludeRecommendations bool   `json:"include_recommendations"`
	IncludeCharts          bool   `json:"include_charts"`
	IncludeTrends          bool   `json:"include_trends"`
	Language               string `json:"language"`
}

// ComplianceReport represents a compliance report
type ComplianceReport struct {
	ReportID    string                 `json:"report_id"`
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	Standards   []string               `json:"standards"`
	TimeRange   TimestampRange         `json:"time_range"`
	Format      string                 `json:"format"`
	Status      string                 `json:"status"` // generating, ready, failed"
	Content     ReportContent          `json:"content"`
	Attachments []ReportAttachment     `json:"attachments,omitempty"`
	GeneratedAt Timestamp              `json:"generated_at"`
	GeneratedBy string                 `json:"generated_by"`
	ExpiresAt   *Timestamp             `json:"expires_at,omitempty"`
	Size        int64                  `json:"size_bytes"`
	URL         string                 `json:"url,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// ReportContent represents report content
type ReportContent struct {
	ExecutiveSummary   ExecutiveSummary           `json:"executive_summary"`
	ComplianceOverview ComplianceOverview         `json:"compliance_overview"`
	StandardResults    []StandardResult           `json:"standard_results"`
	RiskAssessment     RiskAssessment             `json:"risk_assessment"`
	Recommendations    []ComplianceRecommendation `json:"recommendations"`
	Evidence           []ComplianceEvidence       `json:"evidence,omitempty"`
	Appendix           ReportAppendix             `json:"appendix,omitempty"`
}

// ExecutiveSummary represents executive summary
type ExecutiveSummary struct {
	OverallScore     float64  `json:"overall_score"`
	ComplianceRate   float64  `json:"compliance_rate"`
	RiskLevel        string   `json:"risk_level"`
	KeyFindings      []string `json:"key_findings"`
	PriorityIssues   int      `json:"priority_issues"`
	ImprovementAreas []string `json:"improvement_areas"`
}

// ComplianceOverview represents compliance overview
type ComplianceOverview struct {
	TotalStandards        int                `json:"total_standards"`
	CompliantStandards    int                `json:"compliant_standards"`
	PartialStandards      int                `json:"partial_standards"`
	NonCompliantStandards int                `json:"non_compliant_standards"`
	ScoreByStandard       map[string]float64 `json:"score_by_standard"`
	Trends                ComplianceTrends   `json:"trends"`
}

// StandardResult represents a standard result
type StandardResult struct {
	Standard string               `json:"standard"`
	Version  string               `json:"version"`
	Status   string               `json:"status"`
	Score    float64              `json:"score"`
	Controls ControlResults       `json:"controls"`
	Issues   []ComplianceIssue    `json:"issues"`
	Evidence []ComplianceEvidence `json:"evidence"`
}

// ControlResults represents control results
type ControlResults struct {
	Total   int `json:"total"`
	Passed  int `json:"passed"`
	Failed  int `json:"failed"`
	Warning int `json:"warning"`
	NA      int `json:"na"`
}

// RiskAssessment represents risk assessment
type RiskAssessment struct {
	OverallRisk    string             `json:"overall_risk"`
	RiskFactors    []RiskFactor       `json:"risk_factors"`
	RiskMatrix     RiskMatrix         `json:"risk_matrix"`
	MitigationPlan []MitigationAction `json:"mitigation_plan"`
}

// RiskFactor represents a risk factor
type RiskFactor struct {
	Category    string  `json:"category"`
	Impact      string  `json:"impact"`
	Likelihood  string  `json:"likelihood"`
	RiskScore   float64 `json:"risk_score"`
	Description string  `json:"description"`
	Mitigation  string  `json:"mitigation"`
}

// RiskMatrix represents risk matrix
type RiskMatrix struct {
	Grid   map[string]RiskLevel `json:"grid"`
	Levels []RiskLevel          `json:"levels"`
}

// RiskLevel represents a risk level
type RiskLevel struct {
	Name        string  `json:"name"`
	Color       string  `json:"color"`
	MinScore    float64 `json:"min_score"`
	MaxScore    float64 `json:"max_score"`
	Description string  `json:"description"`
}

// MitigationAction represents a mitigation action
type MitigationAction struct {
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Owner       string    `json:"owner"`
	DueDate     Timestamp `json:"due_date"`
	Status      string    `json:"status"`
	Impact      string    `json:"impact"`
}

// ComplianceTrends represents compliance trends
type ComplianceTrends struct {
	ScoreHistory      []TrendPoint `json:"score_history"`
	ComplianceHistory []TrendPoint `json:"compliance_history"`
	RiskHistory       []TrendPoint `json:"risk_history"`
	Period            string       `json:"period"` // daily, weekly, monthly"
}

// ReportAppendix represents report appendix
type ReportAppendix struct {
	Glossary   map[string]string `json:"glossary"`
	References []Reference       `json:"references"`
	ChangeLog  []ChangeRecord    `json:"change_log"`
}

// Reference represents a reference
type Reference struct {
	Title string `json:"title"`
	URL   string `json:"url"`
	Type  string `json:"type"`
}

// ChangeRecord represents a change record
type ChangeRecord struct {
	Date        Timestamp `json:"date"`
	Description string    `json:"description"`
	Author      string    `json:"author"`
}

// ReportAttachment represents a report attachment
type ReportAttachment struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Size     int64  `json:"size"`
	URL      string `json:"url"`
	Checksum string `json:"checksum"`
}

// RemediationResult represents a remediation result
type RemediationResult struct {
	IssueID      string                  `json:"issue_id"`
	Status       string                  `json:"status"`
	Remediated   bool                    `json:"remediated"`
	Changes      []RemediationChange     `json:"changes"`
	Verification RemediationVerification `json:"verification"`
	RemediatedAt Timestamp               `json:"remediated_at"`
	RemediatedBy string                  `json:"remediated_by"`
}

// RemediationChange represents a remediation change
type RemediationChange struct {
	Type        string `json:"type"` // code, config, process, document"
	Description string `json:"description"`
	Path        string `json:"path"`
	OldValue    string `json:"old_value,omitempty"`
	NewValue    string `json:"new_value"`
	Verified    bool   `json:"verified"`
}

// RemediationVerification represents remediation verification
type RemediationVerification struct {
	Method     string    `json:"method"` // automated, manual, peer_review"
	Result     string    `json:"result"` // passed, failed, pending"
	VerifiedBy string    `json:"verified_by"`
	VerifiedAt Timestamp `json:"verified_at"`
	Evidence   []string  `json:"evidence_ids"`
	Comments   string    `json:"comments,omitempty"`
}

// ComplianceIssueListOptions represents compliance issue list options
type ComplianceIssueListOptions struct {
	ListOptions
	Status   []string   `json:"status,omitempty"`
	Severity []string   `json:"severity,omitempty"`
	Standard string     `json:"standard,omitempty"`
	Category string     `json:"category,omitempty"`
	Assignee string     `json:"assignee,omitempty"`
	DateFrom *Timestamp `json:"date_from,omitempty"`
	DateTo   *Timestamp `json:"date_to,omitempty"`
}

// ========================================
// Quality Gate Types
// ========================================

// CreateQualityGateRequest represents a create quality gate request
type CreateQualityGateRequest struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Purpose     string          `json:"purpose"` // pre_commit, pull_request, pre_deploy, post_deploy"
	Criteria    []GateCriterion `json:"criteria"`
	Actions     []GateAction    `json:"actions"`
	Conditions  []GateCondition `json:"conditions"`
	Settings    GateSettings    `json:"settings"`
	Enabled     bool            `json:"enabled"`
}

// GateCriterion represents a gate criterion
type GateCriterion struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Type        string                 `json:"type"` // threshold, trend, comparison, custom`
	Metric      string                 `json:"metric"`
	Operator    string                 `json:"operator"` // gt, lt, eq, ne, gte, lte, contains, regex"
	Value       interface{}            `json:"value"`
	Weight      float64                `json:"weight"`
	Required    bool                   `json:"required"`
	Timeout     int                    `json:"timeout_seconds"`
	Config      map[string]interface{} `json:"config,omitempty"`
}

// GateAction represents a gate action
type GateAction struct {
	Trigger string                 `json:"trigger"` // pass, fail, warning, always"
	Type    string                 `json:"type"`    // notify, block, warn, execute"
	Config  map[string]interface{} `json:"config"`
	Enabled bool                   `json:"enabled"`
}

// GateCondition represents a gate condition
type GateCondition struct {
	Type     string   `json:"type"`     // branch, file, author, time, custom"
	Operator string   `json:"operator"` // in, not_in, contains, regex"
	Values   []string `json:"values"`
	Enabled  bool     `json:"enabled"`
}

// GateSettings represents gate settings
type GateSettings struct {
	ParallelExecution bool     `json:"parallel_execution"`
	FailFast          bool     `json:"fail_fast"`
	Timeout           int      `json:"timeout_seconds"`
	Retries           int      `json:"retries"`
	NotifyOn          []string `json:"notify_on"` // success, failure, warning"
}

// QualityGate represents a quality gate
type QualityGate struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Purpose     string                 `json:"purpose"`
	Criteria    []GateCriterion        `json:"criteria"`
	Actions     []GateAction           `json:"actions"`
	Conditions  []GateCondition        `json:"conditions"`
	Settings    GateSettings           `json:"settings"`
	Status      string                 `json:"status"` // active, inactive, archived"`
	Version     int                    `json:"version"`
	Enabled     bool                   `json:"enabled"`
	CreatedAt   Timestamp              `json:"created_at"`
	UpdatedAt   Timestamp              `json:"updated_at"`
	CreatedBy   string                 `json:"created_by"`
	UpdatedBy   string                 `json:"updated_by"`
	Usage       GateUsage              `json:"usage"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// GateUsage represents gate usage statistics
type GateUsage struct {
	TotalEvaluations   int        `json:"total_evaluations"`
	PassedEvaluations  int        `json:"passed_evaluations"`
	FailedEvaluations  int        `json:"failed_evaluations"`
	WarningEvaluations int        `json:"warning_evaluations"`
	LastEvaluated      *Timestamp `json:"last_evaluated,omitempty"`
}

// UpdateQualityGateRequest represents update quality gate request
type UpdateQualityGateRequest struct {
	Name        *string         `json:"name,omitempty"`
	Description *string         `json:"description,omitempty"`
	Purpose     *string         `json:"purpose,omitempty"`
	Criteria    []GateCriterion `json:"criteria,omitempty"`
	Actions     []GateAction    `json:"actions,omitempty"`
	Conditions  []GateCondition `json:"conditions,omitempty"`
	Settings    *GateSettings   `json:"settings,omitempty"`
	Enabled     *bool           `json:"enabled,omitempty"`
}

// QualityGateContext represents quality gate evaluation context
type QualityGateContext struct {
	EntityType  string                 `json:"entity_type"`
	EntityID    string                 `json:"entity_id"`
	Branch      string                 `json:"branch,omitempty"`
	Author      string                 `json:"author,omitempty"`
	Labels      []string               `json:"labels,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	Environment string                 `json:"environment,omitempty"`
}

// QualityGateResult represents a quality gate evaluation result
type QualityGateResult struct {
	EvaluationID string             `json:"evaluation_id"`
	GateID       string             `json:"gate_id"`
	Context      QualityGateContext `json:"context"`
	Status       string             `json:"status"` // passed, failed, warning, error, skipped"
	Score        float64            `json:"score"`
	Results      []CriterionResult  `json:"results"`
	Summary      GateSummary        `json:"summary"`
	Actions      []ActionResult     `json:"actions"`
	Duration     int                `json:"duration_seconds"`
	EvaluatedAt  Timestamp          `json:"evaluated_at"`
	EvaluatedBy  string             `json:"evaluated_by"`
}

// CriterionResult represents a criterion evaluation result
type CriterionResult struct {
	CriterionID string                 `json:"criterion_id"`
	Name        string                 `json:"name"`
	Status      string                 `json:"status"` // passed, failed, warning, error, skipped"
	Score       float64                `json:"score"`
	Value       interface{}            `json:"value"`
	Expected    interface{}            `json:"expected"`
	Message     string                 `json:"message"`
	Details     map[string]interface{} `json:"details,omitempty"`
	Duration    int                    `json:"duration_ms"`
	Retries     int                    `json:"retries"`
}

// GateSummary represents gate evaluation summary
type GateSummary struct {
	TotalCriteria   int     `json:"total_criteria"`
	PassedCriteria  int     `json:"passed_criteria"`
	FailedCriteria  int     `json:"failed_criteria"`
	WarningCriteria int     `json:"warning_criteria"`
	SkippedCriteria int     `json:"skipped_criteria"`
	ErrorCriteria   int     `json:"error_criteria"`
	OverallScore    float64 `json:"overall_score"`
	Grade           string  `json:"grade"` // A, B, C, D, F"
	Blocked         bool    `json:"blocked"`
	BlockReason     string  `json:"block_reason,omitempty"`
}

// ActionResult represents an action execution result
type ActionResult struct {
	ActionID   string                 `json:"action_id"`
	Type       string                 `json:"type"`
	Status     string                 `json:"status"` // executed, failed, skipped"
	Message    string                 `json:"message"`
	Result     map[string]interface{} `json:"result,omitempty"`
	Duration   int                    `json:"duration_ms"`
	ExecutedAt Timestamp              `json:"executed_at"`
}

// SetGatePolicyRequest represents set gate policy request
type SetGatePolicyRequest struct {
	EntityID   string   `json:"entity_id"`
	EntityType string   `json:"entity_type"`
	GateID     string   `json:"gate_id"`
	Conditions []string `json:"conditions"`
	Required   bool     `json:"required"`
	Override   bool     `json:"override"`
	Comment    string   `json:"comment,omitempty"`
}

// GatePolicy represents a gate policy
type GatePolicy struct {
	EntityID   string      `json:"entity_id"`
	EntityType string      `json:"entity_type"`
	GateID     string      `json:"gate_id"`
	GateName   string      `json:"gate_name"`
	Conditions []string    `json:"conditions"`
	Required   bool        `json:"required"`
	Enabled    bool        `json:"enabled"`
	CreatedAt  Timestamp   `json:"created_at"`
	CreatedBy  string      `json:"created_by"`
	UpdatedAt  Timestamp   `json:"updated_at"`
	UpdatedBy  string      `json:"updated_by"`
	Usage      PolicyUsage `json:"usage"`
}

// PolicyUsage represents policy usage statistics
type PolicyUsage struct {
	TotalApplications int        `json:"total_applications"`
	SuccessfulPasses  int        `json:"successful_passes"`
	Blocks            int        `json:"blocks"`
	Warnings          int        `json:"warnings"`
	LastApplied       *Timestamp `json:"last_applied,omitempty"`
}

// EnforceGatePolicyRequest represents enforce gate policy request
type EnforceGatePolicyRequest struct {
	EntityID   string             `json:"entity_id"`
	EntityType string             `json:"entity_type"`
	Context    QualityGateContext `json:"context"`
	Force      bool               `json:"force"`
	DryRun     bool               `json:"dry_run"`
	Options    EnforcementOptions `json:"options,omitempty"`
}

// EnforcementOptions represents enforcement options
type EnforcementOptions struct {
	Timeout      int      `json:"timeout_seconds"`
	Parallel     bool     `json:"parallel"`
	FailFast     bool     `json:"fail_fast"`
	NotifyOn     []string `json:"notify_on"`
	BypassReason string   `json:"bypass_reason,omitempty"`
}

// PolicyEnforcementResult represents policy enforcement result
type PolicyEnforcementResult struct {
	EnforcementID string              `json:"enforcement_id"`
	EntityID      string              `json:"entity_id"`
	EntityType    string              `json:"entity_type"`
	Status        string              `json:"status"` // passed, failed, blocked, bypassed"
	Policies      []PolicyResult      `json:"policies"`
	Summary       EnforcementSummary  `json:"summary"`
	Actions       []EnforcementAction `json:"actions"`
	EnforcedAt    Timestamp           `json:"enforced_at"`
	EnforcedBy    string              `json:"enforced_by"`
	Duration      int                 `json:"duration_seconds"`
}

// PolicyResult represents a policy enforcement result
type PolicyResult struct {
	PolicyID     string  `json:"policy_id"`
	GateID       string  `json:"gate_id"`
	GateName     string  `json:"gate_name"`
	Status       string  `json:"status"`
	EvaluationID string  `json:"evaluation_id,omitempty"`
	Score        float64 `json:"score"`
	Required     bool    `json:"required"`
	Satisfied    bool    `json:"satisfied"`
	Bypassed     bool    `json:"bypassed"`
	BypassReason string  `json:"bypass_reason,omitempty"`
}

// EnforcementSummary represents enforcement summary
type EnforcementSummary struct {
	TotalPolicies    int     `json:"total_policies"`
	RequiredPolicies int     `json:"required_policies"`
	PassedPolicies   int     `json:"passed_policies"`
	FailedPolicies   int     `json:"failed_policies"`
	BypassedPolicies int     `json:"bypassed_policies"`
	OverallScore     float64 `json:"overall_score"`
	OverallStatus    string  `json:"overall_status"`
	Blocked          bool    `json:"blocked"`
}

// EnforcementAction represents an enforcement action
type EnforcementAction struct {
	Type       string                 `json:"type"`
	Status     string                 `json:"status"`
	Message    string                 `json:"message"`
	Result     map[string]interface{} `json:"result,omitempty"`
	ExecutedAt Timestamp              `json:"executed_at"`
}

// CreateQualityReportRequest represents a quality report request
type QualityReportRequest struct {
	EntityIDs  []string             `json:"entity_ids,omitempty"`
	EntityType string               `json:"entity_type"`
	TimeRange  TimestampRange       `json:"time_range"`
	ReportType string               `json:"report_type"` // summary, detailed, trend, comparative"
	Format     string               `json:"format"`      // json, pdf, html, csv"
	Sections   []string             `json:"sections,omitempty"`
	Options    QualityReportOptions `json:"options,omitempty"`
}

// QualityReportOptions represents quality report options
type QualityReportOptions struct {
	IncludeTrends          bool   `json:"include_trends"`
	IncludeBenchmarks      bool   `json:"include_benchmarks"`
	IncludeRecommendations bool   `json:"include_recommendations"`
	IncludeCharts          bool   `json:"include_charts"`
	Language               string `json:"language"`
}

// QualityReport represents a quality report
type QualityReport struct {
	ReportID    string                 `json:"report_id"`
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	Type        string                 `json:"type"`
	TimeRange   TimestampRange         `json:"time_range"`
	Format      string                 `json:"format"`
	Status      string                 `json:"status"` // generating, ready, failed"
	Content     QualityReportContent   `json:"content"`
	GeneratedAt Timestamp              `json:"generated_at"`
	GeneratedBy string                 `json:"generated_by"`
	ExpiresAt   *Timestamp             `json:"expires_at,omitempty"`
	Size        int64                  `json:"size_bytes"`
	URL         string                 `json:"url,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// QualityReportContent represents quality report content
type QualityReportContent struct {
	ExecutiveSummary    QualityExecutiveSummary   `json:"executive_summary"`
	OverallMetrics      OverallQualityMetrics     `json:"overall_metrics"`
	QualityTrends       QualityTrendsReport       `json:"quality_trends"`
	CategoryBreakdown   CategoryBreakdownReport   `json:"category_breakdown"`
	BenchmarkComparison BenchmarkComparisonReport `json:"benchmark_comparison"`
	Recommendations     []QualityRecommendation   `json:"recommendations"`
	ActionItems         []ActionItem              `json:"action_items"`
}

// QualityExecutiveSummary represents executive summary
type QualityExecutiveSummary struct {
	OverallScore       float64  `json:"overall_score"`
	Grade              string   `json:"grade"`
	Improvement        float64  `json:"improvement_percent"`
	KeyAchievements    []string `json:"key_achievements"`
	CriticalIssues     int      `json:"critical_issues"`
	HighPriorityIssues int      `json:"high_priority_issues"`
	HealthStatus       string   `json:"health_status"` // excellent, good, fair, poor"
}

// OverallQualityMetrics represents overall quality metrics
type OverallQualityMetrics struct {
	CodeQuality     QualityMetricsCategory `json:"code_quality"`
	Security        QualityMetricsCategory `json:"security"`
	Performance     QualityMetricsCategory `json:"performance"`
	TestCoverage    QualityMetricsCategory `json:"test_coverage"`
	Documentation   QualityMetricsCategory `json:"documentation"`
	Maintainability QualityMetricsCategory `json:"maintainability"`
}

// QualityMetricsCategory represents a quality metrics category
type QualityMetricsCategory struct {
	Score   float64            `json:"score"`
	Grade   string             `json:"grade"`
	Metrics map[string]float64 `json:"metrics"`
	Trend   string             `json:"trend"`
	Status  string             `json:"status"`
}

// QualityTrendsReport represents quality trends report
type QualityTrendsReport struct {
	ScoreTrends    []TrendData     `json:"score_trends"`
	CategoryTrends []CategoryTrend `json:"category_trends"`
	MetricTrends   []MetricTrend   `json:"metric_trends"`
	Period         string          `json:"period"`
}

// TrendData represents trend data
type TrendData struct {
	Date  Timestamp `json:"date"`
	Score float64   `json:"score"`
	Grade string    `json:"grade"`
}

// CategoryTrend represents category trend
type CategoryTrend struct {
	Category string      `json:"category"`
	Data     []TrendData `json:"data"`
}

// MetricTrend represents metric trend
type MetricTrend struct {
	Metric string      `json:"metric"`
	Data   []TrendData `json:"data"`
}

// CategoryBreakdownReport represents category breakdown report
type CategoryBreakdownReport struct {
	Categories []CategoryReport `json:"categories"`
	Heatmap    QualityHeatmap   `json:"heatmap"`
}

// CategoryReport represents a category report
type CategoryReport struct {
	Name         string                `json:"name"`
	Score        float64               `json:"score"`
	Grade        string                `json:"grade"`
	Weight       float64               `json:"weight"`
	Contribution float64               `json:"contribution_percent"`
	Metrics      []MetricReport        `json:"metrics"`
	Issues       []CategoryIssue       `json:"issues"`
	Improvements []CategoryImprovement `json:"improvements"`
}

// MetricReport represents a metric report
type MetricReport struct {
	Name        string  `json:"name"`
	Value       float64 `json:"value"`
	Unit        string  `json:"unit"`
	Benchmark   float64 `json:"benchmark"`
	Performance string  `json:"performance"` // above, at, below"
	Trend       string  `json:"trend"`
	Change      float64 `json:"change_percent"`
}

// CategoryIssue represents a category issue
type CategoryIssue struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Severity    string `json:"severity"`
	Impact      string `json:"impact"`
	Description string `json:"description"`
	Status      string `json:"status"`
	Age         int    `json:"age_days"`
}

// CategoryImprovement represents a category improvement
type CategoryImprovement struct {
	Title       string `json:"title"`
	Impact      string `json:"impact"`
	Effort      string `json:"effort"`
	Priority    string `json:"priority"`
	Description string `json:"description"`
}

// QualityHeatmap represents a quality heatmap
type QualityHeatmap struct {
	XAxis []string        `json:"x_axis"`
	YAxis []string        `json:"y_axis"`
	Data  [][]HeatmapCell `json:"data"`
}

// HeatmapCell represents a heatmap cell
type HeatmapCell struct {
	Value float64 `json:"value"`
	Color string  `json:"color"`
	Label string  `json:"label"`
}

// BenchmarkComparisonReport represents benchmark comparison report
type BenchmarkComparisonReport struct {
	IndustryBenchmark BenchmarkData  `json:"industry_benchmark"`
	InternalBenchmark BenchmarkData  `json:"internal_benchmark"`
	TargetBenchmark   BenchmarkData  `json:"target_benchmark"`
	PercentileRank    float64        `json:"percentile_rank"`
	Comparison        ComparisonData `json:"comparison"`
}

// BenchmarkData represents benchmark data
type BenchmarkData struct {
	Score    float64            `json:"score"`
	Category map[string]float64 `json:"category"`
	Source   string             `json:"source"`
	Date     Timestamp          `json:"date"`
}

// ComparisonData represents comparison data
type ComparisonData struct {
	Overall    ComparisonMetric            `json:"overall"`
	Categories map[string]ComparisonMetric `json:"categories"`
	Gaps       []Gap                       `json:"gaps"`
}

// ComparisonMetric represents comparison metric
type ComparisonMetric struct {
	Current    float64 `json:"current"`
	Benchmark  float64 `json:"benchmark"`
	Difference float64 `json:"difference"`
	Percentage float64 `json:"percentage"`
	Status     string  `json:"status"`
}

// Gap represents a performance gap
type Gap struct {
	Category    string  `json:"category"`
	Metric      string  `json:"metric"`
	GapSize     float64 `json:"gap_size"`
	Critical    bool    `json:"critical"`
	Description string  `json:"description"`
}

// QualityRecommendation represents a quality recommendation
type QualityRecommendation struct {
	ID                  string     `json:"id"`
	Title               string     `json:"title"`
	Description         string     `json:"description"`
	Category            string     `json:"category"`
	Priority            string     `json:"priority"`
	Impact              string     `json:"impact"`
	Effort              string     `json:"effort"`
	ExpectedImprovement float64    `json:"expected_improvement"`
	Actions             []string   `json:"actions"`
	Benefits            []string   `json:"benefits"`
	Metrics             []string   `json:"metrics"`
	DueDate             *Timestamp `json:"due_date,omitempty"`
	Assignee            string     `json:"assignee,omitempty"`
	Status              string     `json:"status"`
}

// ActionItem represents an action item
type ActionItem struct {
	ID             string     `json:"id"`
	Title          string     `json:"title"`
	Description    string     `json:"description"`
	Type           string     `json:"type"`
	Priority       string     `json:"priority"`
	Assignee       string     `json:"assignee"`
	Status         string     `json:"status"`
	CreatedAt      Timestamp  `json:"created_at"`
	DueDate        *Timestamp `json:"due_date,omitempty"`
	CompletedAt    *Timestamp `json:"completed_at,omitempty"`
	EstimatedHours int        `json:"estimated_hours"`
	ActualHours    int        `json:"actual_hours"`
}

// CreateGateRequest represents create gate request
type CreateGateRequest struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Type        string          `json:"type"` // pull_request, deployment, schedule, manual"
	Trigger     GateTrigger     `json:"trigger"`
	Criteria    []GateCriterion `json:"criteria"`
	Actions     []GateAction    `json:"actions"`
	Settings    GateSettings    `json:"settings"`
	Enabled     bool            `json:"enabled"`
}

// GateTrigger represents gate trigger
type GateTrigger struct {
	Events   []string `json:"events"`
	Branches []string `json:"branches,omitempty"`
	Paths    []string `json:"paths,omitempty"`
	Tags     []string `json:"tags,omitempty"`
}

// UpdateGateRequest represents update gate request
type UpdateGateRequest struct {
	Name        *string         `json:"name,omitempty"`
	Description *string         `json:"description,omitempty"`
	Type        *string         `json:"type,omitempty"`
	Trigger     *GateTrigger    `json:"trigger,omitempty"`
	Criteria    []GateCriterion `json:"criteria,omitempty"`
	Actions     []GateAction    `json:"actions,omitempty"`
	Settings    *GateSettings   `json:"settings,omitempty"`
	Enabled     *bool           `json:"enabled,omitempty"`
}

// EvaluateGateRequest represents evaluate gate request
type EvaluateGateRequest struct {
	GateID  string             `json:"gate_id"`
	Context QualityGateContext `json:"context"`
	Options EvaluateOptions    `json:"options,omitempty"`
}

// EvaluateOptions represents evaluation options
type EvaluateOptions struct {
	Force   bool `json:"force"`
	DryRun  bool `json:"dry_run"`
	Timeout int  `json:"timeout_seconds"`
	Async   bool `json:"async"`
}

// GateEvaluation represents gate evaluation
type GateEvaluation struct {
	EvaluationID string             `json:"evaluation_id"`
	GateID       string             `json:"gate_id"`
	GateName     string             `json:"gate_name"`
	Context      QualityGateContext `json:"context"`
	Status       string             `json:"status"`
	Result       QualityGateResult  `json:"result,omitempty"`
	StartedAt    Timestamp          `json:"started_at"`
	CompletedAt  *Timestamp         `json:"completed_at,omitempty"`
	Duration     int                `json:"duration_seconds"`
	EvaluatedBy  string             `json:"evaluated_by"`
}
