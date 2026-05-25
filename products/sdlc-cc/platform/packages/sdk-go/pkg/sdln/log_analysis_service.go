package sdln

import (
	"context"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

// LogAnalysisService handles advanced log analysis with pattern recognition
type LogAnalysisService struct {
	service         *AdvancedMonitoringService
	parser     *LogParser
	patterns   *PatternRecognizer
	analyzer   *LogAnalyzer
	aggregator *LogAggregator
	alerting   *LogAlerting
	mlEngine   *MLEngine
	config     LogAnalysisConfig
}

// NewLogAnalysisService creates a new log analysis service
func NewLogAnalysisService(service *AdvancedMonitoringService) *LogAnalysisService {
	return &LogAnalysisService{
		service:    service,
		parser:     NewLogParser(),
		patterns:   NewPatternRecognizer(),
		analyzer:   NewLogAnalyzer(),
		aggregator: NewLogAggregator(),
		alerting:   NewLogAlerting(),
		mlEngine:   NewMLEngine(),
		config: LogAnalysisConfig{
			MaxLogSize:         1 << 20, // 1MB
			PatternWindowSize:  time.Hour,
			AnalysisInterval:   time.Minute * 5,
			RetentionPeriod:    time.Hour * 24 * 30, // 30 days
			MLTrainingInterval: time.Hour * 24,
			EnableML:           true,
			EnablePatterns:     true,
			EnableAggregation:  true,
		},
	}
}

// LogParser parses and normalizes log entries
type LogParser struct {
	formats     map[string]*LogFormat
	extractors  map[string]*FieldExtractor
	normalizer  *LogNormalizer
	transformer *LogTransformer
}

// LogFormat defines a log format
type LogFormat struct {
	Name        string            `json:"name"`
	Pattern    string         `json:"pattern"`
	Fields     []string       `json:"fields"`
	TimeFormat string         `json:"time_format"`
	TimeZone   string         `json:"timezone"`
	Regex      *regexp.Regexp `json:"-"`
}

// FieldExtractor extracts fields from logs
type FieldExtractor struct {
	Name     string                              `json:"name"`
	Type     string                              `json:"type"` // regex, json, grok, csv
	Pattern  string                              `json:"pattern"`
	Fields   []string                            `json:"fields"`
	Regex    *regexp.Regexp                      `json:"-"`
	Function func(string) map[string]interface{} `json:"-"`
}

// LogNormalizer normalizes log entries
type LogNormalizer struct {
	rules    []NormalizationRule
	mappings map[string]string
}

// NormalizationRule defines normalization rule
type NormalizationRule struct {
	From      string            `json:"from"`
	To        string            `json:"to"`
	Type      string            `json:"type"` // replace, extract, transform
	Pattern   string            `json:"pattern"`
	Condition map[string]string `json:"condition"`
}

// LogTransformer transforms log entries
type LogTransformer struct {
	enrichers []LogEnricher
	filters   []LogFilter
	mutators  []LogMutator
}

// LogEnricher enriches log entries
type LogEnricher struct {
	Name     string                 `json:"name"`
	Type     string                 `json:"type"` // geoip, useragent, lookup, compute
	Config   map[string]interface{} `json:"config"`
	Function func(*LogEntry)        `json:"-"`
}

// LogFilter filters log entries
type LogFilter struct {
	Name      string                 `json:"name"`
	Condition map[string]interface{} `json:"condition"`
	Action    string                 `json:"action"` // include, exclude, transform
}

// LogMutator mutates log entries
type LogMutator struct {
	Name     string                 `json:"name"`
	Fields   map[string]interface{} `json:"fields"`
	Function func(*LogEntry)        `json:"-"`
}

// PatternRecognizer recognizes patterns in logs
type PatternRecognizer struct {
	patterns map[string]*LogPattern
	clusters *LogClusterer
	anomaly  *PatternAnomalyDetector
	mu       sync.RWMutex
}

// LogPattern represents a log pattern
type LogPattern struct {
	ID        string                 `json:"id"`
	Name      string                 `json:"name"`
	Signature string                 `json:"signature"`
	Template  string                 `json:"template"`
	Variables []string               `json:"variables"`
	Count     int64                  `json:"count"`
	Frequency float64                `json:"frequency"`
	FirstSeen Timestamp              `json:"first_seen"`
	LastSeen  Timestamp              `json:"last_seen"`
	Samples   []string               `json:"samples"`
	Labels    map[string]string      `json:"labels"`
	Metadata  map[string]interface{} `json:"metadata"`
	Category  string                 `json:"category"` // normal, error, warning, anomaly
	Impact    string                 `json:"impact"`   // low, medium, high, critical
}

// LogClusterer clusters similar log entries
type LogClusterer struct {
	clusters    map[string]*LogCluster
	algorithm   string // kmeans, hierarchical, density
	threshold   float64
	maxClusters int
}

// LogCluster represents a cluster of logs
type LogCluster struct {
	ID     string            `json:"id"`
	Center string            `json:"center"`
	Radius float64           `json:"radius"`
	Points []string          `json:"points"`
	Count  int               `json:"count"`
	Labels map[string]string `json:"labels"`
}

// PatternAnomalyDetector detects anomalies in patterns
type PatternAnomalyDetector struct {
	model     *AnomalyModel
	threshold float64
	window    time.Duration
}

// LogAnomalyModel represents anomaly detection model for log analysis
type LogAnomalyModel struct {
	Type       string                 `json:"type"`
	Parameters map[string]interface{} `json:"parameters"`
	Trained    bool                   `json:"trained"`
	Accuracy   float64                `json:"accuracy"`
}

// LogAnalyzer analyzes log entries
type LogAnalyzer struct {
	analyzers map[string]LogAnalyzerFunc
	metrics   *LogMetrics
}

// LogAnalyzerFunc defines log analyzer function
type LogAnalyzerFunc func(*LogEntry) *AnalysisResult

// AnalysisResult represents analysis result
type AnalysisResult struct {
	Sentiment  *SentimentAnalysis `json:"sentiment"`
	Entities   []Entity           `json:"entities"`
	Topics     []Topic            `json:"topics"`
	Intent     string             `json:"intent"`
	Severity   string             `json:"severity"`
	Category   string             `json:"category"`
	Tags       []string           `json:"tags"`
	Summary    string             `json:"summary"`
	Confidence float64            `json:"confidence"`
}

// SentimentAnalysis represents sentiment analysis
type SentimentAnalysis struct {
	Score     float64 `json:"score"`     // -1.0 to 1.0
	Magnitude float64 `json:"magnitude"` // 0.0 to 1.0
	Label     string  `json:"label"`     // positive, negative, neutral
}

// Entity represents extracted entity
type Entity struct {
	Text       string                 `json:"text"`
	Type       string                 `json:"type"`     // person, organization, location, etc.
	Salience   float64                `json:"salience"` // 0.0 to 1.0
	BeginIndex int                    `json:"begin_index"`
	EndIndex   int                    `json:"end_index"`
	Metadata   map[string]interface{} `json:"metadata"`
}

// Topic represents extracted topic
type Topic struct {
	Name     string   `json:"name"`
	Score    float64  `json:"score"` // relevance score
	Keywords []string `json:"keywords"`
}

// LogMetrics calculates log metrics
type LogMetrics struct {
	counters   map[string]int64
	histograms map[string]*LogHistogram
	timers     map[string]*LogTimer
	gauges     map[string]float64
}

// LogHistogram represents histogram
type LogHistogram struct {
	Buckets []HistogramBucket `json:"buckets"`
	Count   int64             `json:"count"`
	Sum     float64           `json:"sum"`
}

// Timer represents timer
type LogTimer struct {
	Count int64         `json:"count"`
	Sum   time.Duration `json:"sum"`
	Min   time.Duration `json:"min"`
	Max   time.Duration `json:"max"`
}

// LogAggregator aggregates log data
type LogAggregator struct {
	aggregations map[string]*LogAggregation
	timeWindows  []time.Duration
	groupBy      []string
}

// LogAggregation represents log aggregation
type LogAggregation struct {
	ID           string                 `json:"id"`
	Name         string                 `json:"name"`
	Query        string                 `json:"query"`
	TimeWindow   time.Duration          `json:"time_window"`
	GroupBy      []string               `json:"group_by"`
	Aggregations map[string]interface{} `json:"aggregations"` // count, avg, sum, min, max
	Results      map[string]interface{} `json:"results"`
	LastUpdate   Timestamp              `json:"last_update"`
}

// LogAlerting handles log-based alerting
type LogAlerting struct {
	rules    map[string]*LogAlertRule
	notifier AlertNotifier
}

// LogAlertRule defines log alert rule
type LogAlertRule struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	Query        string            `json:"query"`
	Condition    string            `json:"condition"`
	Threshold    int               `json:"threshold"`
	TimeWindow   time.Duration     `json:"time_window"`
	Severity     string            `json:"severity"`
	Description  string            `json:"description"`
	Enabled      bool              `json:"enabled"`
	Labels       map[string]string `json:"labels"`
	Actions      []LogAlertAction  `json:"actions"`
	LastTrigger  *Timestamp        `json:"last_trigger,omitempty"`
	TriggerCount int64             `json:"trigger_count"`
}

// LogAlertAction defines alert action for log analysis
type LogAlertAction struct {
	Type    string                 `json:"type"` // email, slack, webhook, pagerduty
	Config  map[string]interface{} `json:"config"`
	Enabled bool                   `json:"enabled"`
}

// LogAlertNotifier sends notifications for log alerts
type LogAlertNotifier struct {
	channels map[string]LogNotificationChannel
}

// LogNotificationChannel represents notification channel for log alerts
type LogNotificationChannel struct {
	ID     string                 `json:"id"`
	Type   string                 `json:"type"`
	Name   string                 `json:"name"`
	Config map[string]interface{} `json:"config"`
}

// MLEngine provides machine learning capabilities
type MLEngine struct {
	classifiers map[string]*LogClassifier
	predictors  map[string]*LogPredictor
	embeddings  *LogEmbeddingGenerator
}

// LogClassifier classifies log entries
type LogClassifier struct {
	Name     string      `json:"name"`
	Type     string      `json:"type"` // logistic, naive_bayes, svm, neural
	Features []string    `json:"features"`
	Labels   []string    `json:"labels"`
	Model    interface{} `json:"model"`
	Accuracy float64     `json:"accuracy"`
	Trained  bool        `json:"trained"`
}

// LogPredictor predicts log metrics
type LogPredictor struct {
	Name     string      `json:"name"`
	Type     string      `json:"type"` // linear, polynomial, lstm, prophet
	Target   string      `json:"target"`
	Features []string    `json:"features"`
	Model    interface{} `json:"model"`
	Accuracy float64     `json:"accuracy"`
	Trained  bool        `json:"trained"`
}

// LogEmbeddingGenerator generates embeddings for logs
type LogEmbeddingGenerator struct {
	Model      string    `json:"model"` // word2vec, fasttext, bert, custom
	Vector     []float64 `json:"vector"`
	Dimensions int       `json:"dimensions"`
}

// LogAnalysisConfig configures log analysis
type LogAnalysisConfig struct {
	MaxLogSize         time.Duration `json:"max_log_size"`
	PatternWindowSize  time.Duration `json:"pattern_window_size"`
	AnalysisInterval   time.Duration `json:"analysis_interval"`
	RetentionPeriod    time.Duration `json:"retention_period"`
	MLTrainingInterval time.Duration `json:"ml_training_interval"`
	EnableML           bool          `json:"enable_ml"`
	EnablePatterns     bool          `json:"enable_patterns"`
	EnableAggregation  bool          `json:"enable_aggregation"`
}

// NewLogParser creates a new log parser
func NewLogParser() *LogParser {
	return &LogParser{
		formats: map[string]*LogFormat{
			"json": {
				Name:    "json",
				Pattern: `^{.*}$`,
				Fields:  []string{"timestamp", "level", "message", "service"},
			},
			"apache_common": {
				Name:       "apache_common",
				Pattern:    `^(\S+) \S+ \S+ \[([\w:/]+\s[+\-]\d{4})\] "(\S+) (\S+) (\S+)" (\d{3}) (\d+)$`,
				Fields:     []string{"host", "timestamp", "method", "path", "protocol", "status", "size"},
				TimeFormat: "02/Jan/2006:15:04:05 -0700",
			},
			"nginx_error": {
				Name:       "nginx_error",
				Pattern:    `^(\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\] (\d+)#(\d+): (.*)$`,
				Fields:     []string{"timestamp", "level", "pid", "tid", "message"},
				TimeFormat: "2006/01/02 15:04:05",
			},
		},
		extractors: map[string]*FieldExtractor{
			"ip": {
				Name:    "ip",
				Type:    "regex",
				Pattern: `\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b`,
				Fields:  []string{"ip"},
			},
			"user_agent": {
				Name:    "user_agent",
				Type:    "regex",
				Pattern: `\([^\)]+\)`,
				Fields:  []string{"user_agent"},
			},
			"request_id": {
				Name:    "request_id",
				Type:    "regex",
				Pattern: `[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}`,
				Fields:  []string{"request_id"},
			},
		},
		normalizer: &LogNormalizer{
			rules: []NormalizationRule{
				{
					From: `\d+\.\d+\.\d+\.\d+`,
					To:   "IP_ADDRESS",
					Type: "replace",
				},
				{
					From: `[a-f0-9]{32}`,
					To:   "HASH",
					Type: "replace",
				},
			},
		},
		transformer: &LogTransformer{
			enrichers: []LogEnricher{
				{
					Name: "timestamp_iso",
					Type: "compute",
					Function: func(entry *LogEntry) {
						if time.Time(entry.Timestamp).IsZero() {
							entry.Timestamp = NewTimestampNow()
						}
					},
				},
			},
		},
	}
}

// NewPatternRecognizer creates a new pattern recognizer
func NewPatternRecognizer() *PatternRecognizer {
	return &PatternRecognizer{
		patterns: make(map[string]*LogPattern),
		clusters: &LogClusterer{
			clusters:    make(map[string]*LogCluster),
			algorithm:   "kmeans",
			threshold:   0.8,
			maxClusters: 1000,
		},
		anomaly: &PatternAnomalyDetector{
			threshold: 0.1,
			window:    time.Hour,
		},
	}
}

// NewLogAnalyzer creates a new log analyzer
func NewLogAnalyzer() *LogAnalyzer {
	return &LogAnalyzer{
		analyzers: map[string]LogAnalyzerFunc{
			"sentiment": analyzeSentiment,
			"entities":  extractEntities,
			"topics":    extractTopics,
			"severity":  detectSeverity,
		},
		metrics: &LogMetrics{
			counters:   make(map[string]int64),
			histograms: make(map[string]*LogHistogram),
			timers:     make(map[string]*LogTimer),
			gauges:     make(map[string]float64),
		},
	}
}

// NewLogAggregator creates a new log aggregator
func NewLogAggregator() *LogAggregator {
	return &LogAggregator{
		aggregations: make(map[string]*LogAggregation),
		timeWindows:  []time.Duration{time.Minute, time.Hour, 24 * time.Hour},
		groupBy:      []string{"service", "level", "host"},
	}
}

// NewLogAlerting creates a new log alerting
func NewLogAlerting() *LogAlerting {
	return &LogAlerting{
		rules:    make(map[string]*LogAlertRule),
		notifier: nil,
	}
}

// NewMLEngine creates a new ML engine
func NewMLEngine() *MLEngine {
	return &MLEngine{
		classifiers: make(map[string]*LogClassifier),
		predictors:  make(map[string]*LogPredictor),
		embeddings: &LogEmbeddingGenerator{
			Model:      "word2vec",
			Dimensions: 100,
		},
	}
}

// ParseLog parses a log entry
func (las *LogAnalysisService) ParseLog(ctx context.Context, rawLog string, format string) (*LogEntry, error) {
	// Parse using format
	entry, err := las.parser.parse(rawLog, format)
	if err != nil {
		return nil, fmt.Errorf("failed to parse log: %w", err)
	}

	// Normalize
	las.parser.normalizer.normalize(entry)

	// Transform
	las.parser.transformer.transform(entry)

	// Analyze if enabled
	if las.config.EnablePatterns {
		analysis := las.analyzeLog(entry)
		if analysis != nil {
			entry.Fields["analysis"] = analysis
		}
	}

	return entry, nil
}

// parse parses log using specified format
func (lp *LogParser) parse(rawLog, formatName string) (*LogEntry, error) {
	format, exists := lp.formats[formatName]
	if !exists {
		return nil, fmt.Errorf("unknown format: %s", formatName)
	}

	entry := &LogEntry{
		ID:        generateUUID(),
		Message:   rawLog,
		Source:    formatName,
		Timestamp: NewTimestampNow(),
		Fields:    make(map[string]interface{}),
		Labels:    make(map[string]string),
	}

	// Extract fields using regex
	if format.Regex == nil {
		format.Regex = regexp.MustCompile(format.Pattern)
	}

	matches := format.Regex.FindStringSubmatch(rawLog)
	if len(matches) > 0 {
		for i, field := range format.Fields {
			if i+1 < len(matches) {
				entry.Fields[field] = matches[i+1]
			}
		}
	}

	// Parse timestamp
	if ts, exists := entry.Fields["timestamp"]; exists {
		if tsStr, ok := ts.(string); ok {
			if parsed, err := time.Parse(format.TimeFormat, tsStr); err == nil {
				entry.Timestamp = Timestamp(parsed)
			}
		}
	}

	// Extract additional fields
	for name, extractor := range lp.extractors {
		if extractor.Regex == nil {
			extractor.Regex = regexp.MustCompile(extractor.Pattern)
		}

		matches := extractor.Regex.FindAllStringSubmatch(rawLog, -1)
		if len(matches) > 0 {
			for _, match := range matches {
				if len(match) > 1 {
					entry.Fields[name] = match[1]
					break
				}
			}
		}
	}

	// Set level
	if level, exists := entry.Fields["level"]; exists {
		entry.Level = strings.ToLower(fmt.Sprintf("%v", level))
	}

	return entry, nil
}

// normalize normalizes log entry
func (ln *LogNormalizer) normalize(entry *LogEntry) {
	message := entry.Message

	// Apply normalization rules
	for _, rule := range ln.rules {
		if rule.Type == "replace" {
			re := regexp.MustCompile(rule.From)
			message = re.ReplaceAllString(message, rule.To)
		}
	}

	entry.Message = message
}

// transform transforms log entry
func (lt *LogTransformer) transform(entry *LogEntry) {
	// Apply enrichers
	for _, enricher := range lt.enrichers {
		if enricher.Function != nil {
			enricher.Function(entry)
		}
	}

	// Apply filters
	for _, filter := range lt.filters {
		if lt.matchesFilter(entry, filter) {
			if filter.Action == "exclude" {
				// Mark for exclusion
				entry.Labels["excluded"] = "true"
			}
		}
	}

	// Apply mutators
	for _, mutator := range lt.mutators {
		if mutator.Function != nil {
			mutator.Function(entry)
		}
	}
}

// matchesFilter checks if entry matches filter
func (lt *LogTransformer) matchesFilter(entry *LogEntry, filter LogFilter) bool {
	// Simple implementation
	for field, expected := range filter.Condition {
		if value, exists := entry.Fields[field]; exists {
			if fmt.Sprintf("%v", value) != fmt.Sprintf("%v", expected) {
				return false
			}
		} else {
			return false
		}
	}
	return true
}

// analyzeLog analyzes log entry
func (las *LogAnalysisService) analyzeLog(entry *LogEntry) *AnalysisResult {
	result := &AnalysisResult{
		Tags:       []string{},
		Confidence: 0.0,
	}

	// Run analyzers
	for name, analyzer := range las.analyzer.analyzers {
		if analysisResult := analyzer(entry); analysisResult != nil {
			// Merge results
			if name == "sentiment" && analysisResult.Sentiment != nil {
				result.Sentiment = analysisResult.Sentiment
			}
			if name == "entities" {
				result.Entities = append(result.Entities, analysisResult.Entities...)
			}
			if name == "topics" {
				result.Topics = append(result.Topics, analysisResult.Topics...)
			}
			if name == "severity" && analysisResult.Severity != "" {
				result.Severity = analysisResult.Severity
			}
			result.Tags = append(result.Tags, analysisResult.Tags...)
			result.Confidence = math.Max(result.Confidence, analysisResult.Confidence)
		}
	}

	return result
}

// AnalyzeSentiment analyzes sentiment of log message
func analyzeSentiment(entry *LogEntry) *AnalysisResult {
	message := strings.ToLower(entry.Message)

	var score float64
	var label string

	// Simple sentiment analysis
	positiveWords := []string{"success", "completed", "ok", "good", "healthy", "ready"}
	negativeWords := []string{"error", "failed", "exception", "timeout", "dead", "unhealthy"}

	for _, word := range positiveWords {
		if strings.Contains(message, word) {
			score += 0.2
		}
	}

	for _, word := range negativeWords {
		if strings.Contains(message, word) {
			score -= 0.3
		}
	}

	if score > 0.1 {
		label = "positive"
	} else if score < -0.1 {
		label = "negative"
	} else {
		label = "neutral"
	}

	return &AnalysisResult{
		Sentiment: &SentimentAnalysis{
			Score:     math.Max(-1, math.Min(1, score)),
			Magnitude: math.Abs(score),
			Label:     label,
		},
		Confidence: 0.7,
	}
}

// extractEntities extracts entities from log message
func extractEntities(entry *LogEntry) *AnalysisResult {
	message := entry.Message
	var entities []Entity

	// Extract IPs
	ipRegex := regexp.MustCompile(`\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b`)
	matches := ipRegex.FindAllStringSubmatchIndex(message, -1)
	for _, match := range matches {
		entities = append(entities, Entity{
			Text:       message[match[0]:match[1]],
			Type:       "ip_address",
			Salience:   0.5,
			BeginIndex: match[0],
			EndIndex:   match[1],
		})
	}

	// Extract URLs
	urlRegex := regexp.MustCompile(`https?://[^\s]+`)
	matches = urlRegex.FindAllStringSubmatchIndex(message, -1)
	for _, match := range matches {
		entities = append(entities, Entity{
			Text:       message[match[0]:match[1]],
			Type:       "url",
			Salience:   0.6,
			BeginIndex: match[0],
			EndIndex:   match[1],
		})
	}

	return &AnalysisResult{
		Entities:   entities,
		Confidence: 0.8,
	}
}

// extractTopics extracts topics from log message
func extractTopics(entry *LogEntry) *AnalysisResult {
	message := strings.ToLower(entry.Message)

	topics := []Topic{
		{
			Name:     "system",
			Score:    0.5,
			Keywords: []string{"system", "service", "process"},
		},
		{
			Name:     "error",
			Score:    0.3,
			Keywords: []string{"error", "exception", "failed"},
		},
		{
			Name:     "performance",
			Score:    0.2,
			Keywords: []string{"slow", "timeout", "latency"},
		},
	}

	// Score topics based on message content
	for i, topic := range topics {
		count := 0
		for _, keyword := range topic.Keywords {
			if strings.Contains(message, keyword) {
				count++
			}
		}
		topics[i].Score = float64(count) / float64(len(topic.Keywords))
	}

	return &AnalysisResult{
		Topics:     topics,
		Confidence: 0.6,
	}
}

// detectSeverity detects severity of log message
func detectSeverity(entry *LogEntry) *AnalysisResult {
	message := strings.ToLower(entry.Message)
	level := strings.ToLower(entry.Level)

	severity := "info"

	// Check level first
	switch level {
	case "fatal", "critical":
		severity = "critical"
	case "error", "err":
		severity = "error"
	case "warning", "warn":
		severity = "warning"
	case "info", "information":
		severity = "info"
	case "debug", "trace":
		severity = "debug"
	default:
		// Check message content
		if strings.Contains(message, "fatal") || strings.Contains(message, "critical") {
			severity = "critical"
		} else if strings.Contains(message, "error") || strings.Contains(message, "exception") {
			severity = "error"
		} else if strings.Contains(message, "warning") || strings.Contains(message, "warn") {
			severity = "warning"
		}
	}

	return &AnalysisResult{
		Severity:   severity,
		Confidence: 0.9,
	}
}

// RecognizePattern recognizes patterns in logs
func (las *LogAnalysisService) RecognizePattern(ctx context.Context, logEntry *LogEntry) (*LogPattern, error) {
	if !las.config.EnablePatterns {
		return nil, fmt.Errorf("pattern recognition is disabled")
	}

	// Generate signature
	signature := las.generateSignature(logEntry.Message)

	las.patterns.mu.Lock()
	defer las.patterns.mu.Unlock()

	// Check if pattern exists
	if pattern, exists := las.patterns.patterns[signature]; exists {
		// Update pattern
		pattern.Count++
		pattern.LastSeen = NewTimestampNow()
		if len(pattern.Samples) < 10 {
			pattern.Samples = append(pattern.Samples, logEntry.Message)
		}
		return pattern, nil
	}

	// Create new pattern
	pattern := &LogPattern{
		ID:        generateUUID(),
		Signature: signature,
		Template:  las.extractTemplate(logEntry.Message),
		Variables: las.extractVariables(logEntry.Message, signature),
		Count:     1,
		FirstSeen: NewTimestampNow(),
		LastSeen:  NewTimestampNow(),
		Samples:   []string{logEntry.Message},
		Labels:    make(map[string]string),
		Category:  "normal",
		Impact:    "low",
	}

	// Classify pattern
	las.classifyPattern(pattern)

	las.patterns.patterns[signature] = pattern

	return pattern, nil
}

// generateSignature generates signature for log message
func (las *LogAnalysisService) generateSignature(message string) string {
	// Normalize message
	sig := strings.ToLower(message)

	// Replace numbers with placeholder
	re := regexp.MustCompile(`\d+`)
	sig = re.ReplaceAllString(sig, "N")

	// Replace UUIDs
	re = regexp.MustCompile(`[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}`)
	sig = re.ReplaceAllString(sig, "UUID")

	// Replace IPs
	re = regexp.MustCompile(`\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b`)
	sig = re.ReplaceAllString(sig, "IP")

	return sig
}

// extractTemplate extracts template from message
func (las *LogAnalysisService) extractTemplate(message string) string {
	// Similar to signature but preserves more structure
	template := message

	re := regexp.MustCompile(`\d+`)
	template = re.ReplaceAllString(template, "${num}")

	re = regexp.MustCompile(`[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}`)
	template = re.ReplaceAllString(template, "${uuid}")

	re = regexp.MustCompile(`\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b`)
	template = re.ReplaceAllString(template, "${ip}")

	return template
}

// extractVariables extracts variables from message
func (las *LogAnalysisService) extractVariables(message, signature string) []string {
	var variables []string

	// Extract numbers
	re := regexp.MustCompile(`\d+`)
	matches := re.FindAllString(message, -1)
	for _, match := range matches {
		variables = append(variables, match)
	}

	// Extract UUIDs
	re = regexp.MustCompile(`[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}`)
	matches = re.FindAllString(message, -1)
	for _, match := range matches {
		variables = append(variables, match)
	}

	return variables
}

// classifyPattern classifies pattern
func (las *LogAnalysisService) classifyPattern(pattern *LogPattern) {
	template := strings.ToLower(pattern.Template)

	// Error patterns
	if strings.Contains(template, "error") || strings.Contains(template, "exception") || strings.Contains(template, "failed") {
		pattern.Category = "error"
		pattern.Impact = "high"
	}

	// Warning patterns
	if strings.Contains(template, "warning") || strings.Contains(template, "deprecated") || strings.Contains(template, "retry") {
		pattern.Category = "warning"
		pattern.Impact = "medium"
	}

	// Performance patterns
	if strings.Contains(template, "slow") || strings.Contains(template, "timeout") || strings.Contains(template, "latency") {
		pattern.Category = "performance"
		pattern.Impact = "medium"
	}

	// Security patterns
	if strings.Contains(template, "unauthorized") || strings.Contains(template, "forbidden") || strings.Contains(template, "attack") {
		pattern.Category = "security"
		pattern.Impact = "critical"
	}
}

// GetPatterns retrieves recognized patterns
func (las *LogAnalysisService) GetPatterns(ctx context.Context, tenantID string, timeRange *TimeRange) ([]LogPattern, error) {
	las.patterns.mu.RLock()
	defer las.patterns.mu.RUnlock()

	var patterns []LogPattern
	for _, pattern := range las.patterns.patterns {
		// Filter by time range
		if timeRange != nil {
			if time.Time(pattern.FirstSeen).Before(time.Time(timeRange.From)) || time.Time(pattern.LastSeen).After(time.Time(timeRange.To)) {
				continue
			}
		}
		patterns = append(patterns, *pattern)
	}

	// Sort by frequency
	sort.Slice(patterns, func(i, j int) bool {
		return patterns[i].Count > patterns[j].Count
	})

	return patterns, nil
}

// DetectAnomalies detects anomalies in log patterns
func (las *LogAnalysisService) DetectAnomalies(ctx context.Context, tenantID string, timeRange *TimeRange) ([]PatternAnomaly, error) {
	var anomalies []PatternAnomaly

	las.patterns.mu.RLock()
	defer las.patterns.mu.RUnlock()

	// Analyze pattern frequencies
	totalCount := int64(0)
	for _, pattern := range las.patterns.patterns {
		totalCount += pattern.Count
	}

	// Detect unusual patterns
	for _, pattern := range las.patterns.patterns {
		expectedFrequency := float64(pattern.Count) / float64(totalCount)

		// If pattern is too rare or too frequent
		if expectedFrequency < 0.001 && pattern.Count > 10 {
			anomalies = append(anomalies, PatternAnomaly{
				PatternID:   pattern.ID,
				Type:        "rare_pattern",
				Confidence:  0.8,
				Description: fmt.Sprintf("Pattern '%s' is unusually rare", pattern.Template),
				Severity:    "warning",
			})
		}

		// If pattern suddenly appeared
		timeSinceFirst := time.Since(time.Time(pattern.FirstSeen))
		if timeSinceFirst < time.Hour && pattern.Count > 100 {
			anomalies = append(anomalies, PatternAnomaly{
				PatternID:   pattern.ID,
				Type:        "sudden_appearance",
				Confidence:  0.9,
				Description: fmt.Sprintf("Pattern '%s' suddenly appeared", pattern.Template),
				Severity:    "warning",
			})
		}
	}

	return anomalies, nil
}

// PatternAnomaly represents a pattern anomaly
type PatternAnomaly struct {
	PatternID   string    `json:"pattern_id"`
	Type        string    `json:"type"`
	Confidence  float64   `json:"confidence"`
	Description string    `json:"description"`
	Severity    string    `json:"severity"`
	Timestamp   Timestamp `json:"timestamp"`
}

// AggregateLogs aggregates log data
func (las *LogAnalysisService) AggregateLogs(ctx context.Context, tenantID string, aggregation *LogAggregation) (*LogAggregationResult, error) {
	result := &LogAggregationResult{
		AggregationID: aggregation.ID,
		Results:       make(map[string]interface{}),
		Timestamp:     NewTimestampNow(),
	}

	// This would query logs and perform aggregation
	// For now, return mock results

	switch aggregation.GroupBy[0] {
	case "level":
		result.Results["error"] = map[string]interface{}{
			"count": 100,
			"avg":   1.5,
		}
		result.Results["warning"] = map[string]interface{}{
			"count": 250,
			"avg":   1.2,
		}
		result.Results["info"] = map[string]interface{}{
			"count": 1000,
			"avg":   1.0,
		}
	}

	return result, nil
}

// LogAggregationResult represents aggregation result
type LogAggregationResult struct {
	AggregationID string                 `json:"aggregation_id"`
	Results       map[string]interface{} `json:"results"`
	Timestamp     Timestamp              `json:"timestamp"`
}

// SearchLogs searches logs with advanced query
func (las *LogAnalysisService) SearchLogs(ctx context.Context, tenantID string, query *AdvancedLogQuery) (*LogSearchResult, error) {
	// This would implement advanced log search
	// For now, return mock result
	return &LogSearchResult{
		Logs:  []LogEntry{},
		Total: 0,
		Query: query,
		Took:  time.Millisecond * 50,
	}, nil
}

// AdvancedLogQuery defines advanced log search query
type AdvancedLogQuery struct {
	Query        string                 `json:"query"`
	Filters      map[string]interface{} `json:"filters"`
	TimeRange    *TimeRange             `json:"time_range"`
	SortBy       string                 `json:"sort_by"`
	SortDesc     bool                   `json:"sort_desc"`
	Limit        int                    `json:"limit"`
	Offset       int                    `json:"offset"`
	Highlight    bool                   `json:"highlight"`
	Aggregations []LogAggregation       `json:"aggregations"`
}

// LogSearchResult represents log search result
type LogSearchResult struct {
	Logs  []LogEntry             `json:"logs"`
	Total int64                  `json:"total"`
	Query *AdvancedLogQuery      `json:"query"`
	Took  time.Duration          `json:"took"`
	Aggs  map[string]interface{} `json:"aggs,omitempty"`
}

// GetLogMetrics gets log metrics
func (las *LogAnalysisService) GetLogMetrics(ctx context.Context, tenantID string, timeRange *TimeRange) (*LogMetricsReport, error) {
	report := &LogMetricsReport{
		TenantID:   tenantID,
		TimeRange:  *timeRange,
		Timestamp:  NewTimestampNow(),
		Counts:     make(map[string]int64),
		Rates:      make(map[string]float64),
		LogHistograms: make(map[string]*LogHistogram),
		TopLogs:    []string{},
		Errors:     []ErrorPattern{},
	}

	// Mock metrics
	report.Counts["total"] = 10000
	report.Counts["error"] = 100
	report.Counts["warning"] = 500
	report.Counts["info"] = 9400

	report.Rates["total_per_second"] = 10.0
	report.Rates["error_rate"] = 0.01
	report.Rates["warning_rate"] = 0.05

	report.LogHistograms["latency"] = &LogHistogram{
		Buckets: []HistogramBucket{
			{UpperBound: 10, Count: 1000},
			{UpperBound: 100, Count: 8000},
			{UpperBound: 1000, Count: 900},
			{UpperBound: math.Inf(1), Count: 100},
		},
		Count: 10000,
		Sum:   500000,
	}

	return report, nil
}

// LogMetricsReport represents log metrics report
type LogMetricsReport struct {
	TenantID   string                   `json:"tenant_id"`
	TimeRange  TimeRange                `json:"time_range"`
	Timestamp  Timestamp                `json:"timestamp"`
	Counts     map[string]int64         `json:"counts"`
	Rates      map[string]float64       `json:"rates"`
	LogHistograms map[string]*LogHistogram    `json:"histograms"`
	TopLogs    []string                 `json:"top_logs"`
	Errors     []ErrorPattern           `json:"errors"`
}

// ErrorPattern represents an error pattern
type ErrorPattern struct {
	Pattern   string    `json:"pattern"`
	Count     int64     `json:"count"`
	FirstSeen Timestamp `json:"first_seen"`
	LastSeen  Timestamp `json:"last_seen"`
	Severity  string    `json:"severity"`
}
