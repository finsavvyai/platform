package fraud

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"
)

// Handler handles fraud detection HTTP requests
type Handler struct {
	fraudService interfaces.FraudDetectionService
	router       interfaces.IntelligentRouter
	validator    *validator.Validate
}

// NewHandler creates a new fraud detection handler
func NewHandler(fraudService interfaces.FraudDetectionService, router interfaces.IntelligentRouter) *Handler {
	return &Handler{
		fraudService: fraudService,
		router:       router,
		validator:    validator.New(),
	}
}

// AnalyzeTransactionRequest represents the request for single transaction analysis
type AnalyzeTransactionRequest struct {
	Transaction *models.TransactionData `json:"transaction" validate:"required"`
	Options     *AnalysisOptions        `json:"options,omitempty"`
}

// AnalyzeBatchRequest represents the request for batch transaction analysis
type AnalyzeBatchRequest struct {
	Transactions []*models.TransactionData `json:"transactions" validate:"required,min=1,max=1000"`
	Options      *AnalysisOptions          `json:"options,omitempty"`
}

// AnalysisOptions represents options for fraud analysis
type AnalysisOptions struct {
	ForceQuantum       bool `json:"force_quantum,omitempty"`
	ForceClassical     bool `json:"force_classical,omitempty"`
	IncludeExplanation bool `json:"include_explanation,omitempty"`
	TimeoutMs          int  `json:"timeout_ms,omitempty" validate:"omitempty,min=100,max=10000"`
}

// AnalyzeTransactionResponse represents the response for transaction analysis
type AnalyzeTransactionResponse struct {
	Result           *models.FraudResult `json:"result"`
	ProcessingMethod string              `json:"processing_method"`
	RequestID        string              `json:"request_id"`
	ProcessedAt      time.Time           `json:"processed_at"`
}

// AnalyzeBatchResponse represents the response for batch analysis
type AnalyzeBatchResponse struct {
	Results          []*models.FraudResult `json:"results"`
	ProcessingMethod string                `json:"processing_method"`
	RequestID        string                `json:"request_id"`
	ProcessedAt      time.Time             `json:"processed_at"`
	TotalProcessed   int                   `json:"total_processed"`
	SuccessCount     int                   `json:"success_count"`
	ErrorCount       int                   `json:"error_count"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	ErrorCode string                 `json:"error_code"`
	Message   string                 `json:"message"`
	Details   map[string]interface{} `json:"details,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
	RequestID string                 `json:"request_id"`
}

// AnalyzeTransaction handles POST /v1/analyze for single transaction fraud detection
func (h *Handler) AnalyzeTransaction(c *gin.Context) {
	requestID := generateRequestID()
	c.Header("X-Request-ID", requestID)

	var req AnalyzeTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.sendError(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request format",
			map[string]interface{}{"validation_error": err.Error()}, requestID)
		return
	}

	// Validate request
	if err := h.validator.Struct(&req); err != nil {
		h.sendError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Request validation failed",
			map[string]interface{}{"validation_errors": err.Error()}, requestID)
		return
	}

	// Validate transaction data
	if err := req.Transaction.Validate(); err != nil {
		h.sendError(c, http.StatusBadRequest, "INVALID_TRANSACTION", "Transaction validation failed",
			map[string]interface{}{"transaction_error": err.Error()}, requestID)
		return
	}

	// Set timeout context
	ctx := c.Request.Context()
	if req.Options != nil && req.Options.TimeoutMs > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, time.Duration(req.Options.TimeoutMs)*time.Millisecond)
		defer cancel()
	}

	// Determine processing method
	processingMethod, err := h.determineProcessingMethod(ctx, req.Transaction, req.Options)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, "ROUTING_ERROR", "Failed to determine processing method",
			map[string]interface{}{"error": err.Error()}, requestID)
		return
	}

	// Process transaction based on method
	var result *models.FraudResult
	switch processingMethod {
	case interfaces.ProcessingMethodQuantum:
		result, err = h.fraudService.AnalyzeTransactionQuantum(ctx, req.Transaction)
	case interfaces.ProcessingMethodClassical:
		classicalResult, classicalErr := h.fraudService.AnalyzeTransactionClassical(ctx, req.Transaction)
		if classicalErr != nil {
			err = classicalErr
		} else {
			// Convert classical result to fraud result
			result = h.convertClassicalToFraudResult(classicalResult)
		}
	default:
		h.sendError(c, http.StatusInternalServerError, "UNSUPPORTED_METHOD", "Unsupported processing method",
			map[string]interface{}{"method": processingMethod}, requestID)
		return
	}

	if err != nil {
		// Try fallback if quantum processing failed
		if processingMethod == interfaces.ProcessingMethodQuantum {
			classicalResult, fallbackErr := h.fraudService.AnalyzeTransactionClassical(ctx, req.Transaction)
			if fallbackErr != nil {
				h.sendError(c, http.StatusInternalServerError, "PROCESSING_ERROR", "Both quantum and classical processing failed",
					map[string]interface{}{"quantum_error": err.Error(), "classical_error": fallbackErr.Error()}, requestID)
				return
			}
			result = h.convertClassicalToFraudResult(classicalResult)
			processingMethod = interfaces.ProcessingMethodClassical
		} else {
			h.sendError(c, http.StatusInternalServerError, "PROCESSING_ERROR", "Transaction processing failed",
				map[string]interface{}{"error": err.Error()}, requestID)
			return
		}
	}

	// Validate processing time requirement (sub-100ms)
	if result.ProcessingTimeMs > 100 {
		// Log warning but don't fail the request
		// In production, this would trigger monitoring alerts
	}

	response := &AnalyzeTransactionResponse{
		Result:           result,
		ProcessingMethod: string(processingMethod),
		RequestID:        requestID,
		ProcessedAt:      time.Now(),
	}

	c.JSON(http.StatusOK, response)
}

// AnalyzeBatch handles POST /v1/analyze/batch for high-volume batch processing
func (h *Handler) AnalyzeBatch(c *gin.Context) {
	requestID := generateRequestID()
	c.Header("X-Request-ID", requestID)

	var req AnalyzeBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.sendError(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request format",
			map[string]interface{}{"validation_error": err.Error()}, requestID)
		return
	}

	// Validate request
	if err := h.validator.Struct(&req); err != nil {
		h.sendError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Request validation failed",
			map[string]interface{}{"validation_errors": err.Error()}, requestID)
		return
	}

	// Validate each transaction
	for i, transaction := range req.Transactions {
		if err := transaction.Validate(); err != nil {
			h.sendError(c, http.StatusBadRequest, "INVALID_TRANSACTION", "Transaction validation failed",
				map[string]interface{}{
					"transaction_index": i,
					"transaction_id":    transaction.TransactionID,
					"error":             err.Error(),
				}, requestID)
			return
		}
	}

	// Set timeout context
	ctx := c.Request.Context()
	if req.Options != nil && req.Options.TimeoutMs > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, time.Duration(req.Options.TimeoutMs)*time.Millisecond)
		defer cancel()
	}

	// Determine processing method for batch
	processingMethod, err := h.determineBatchProcessingMethod(ctx, req.Transactions, req.Options)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, "ROUTING_ERROR", "Failed to determine processing method",
			map[string]interface{}{"error": err.Error()}, requestID)
		return
	}

	// Process batch based on method
	var results []*models.FraudResult
	var successCount, errorCount int

	switch processingMethod {
	case interfaces.ProcessingMethodQuantum:
		results, err = h.fraudService.AnalyzeBatchQuantum(ctx, req.Transactions)
		if err != nil {
			// Try classical fallback for entire batch
			classicalResults, fallbackErr := h.processBatchClassical(ctx, req.Transactions)
			if fallbackErr != nil {
				h.sendError(c, http.StatusInternalServerError, "PROCESSING_ERROR", "Both quantum and classical batch processing failed",
					map[string]interface{}{"quantum_error": err.Error(), "classical_error": fallbackErr.Error()}, requestID)
				return
			}
			results = classicalResults
			processingMethod = interfaces.ProcessingMethodClassical
		}
	case interfaces.ProcessingMethodClassical:
		results, err = h.processBatchClassical(ctx, req.Transactions)
		if err != nil {
			h.sendError(c, http.StatusInternalServerError, "PROCESSING_ERROR", "Batch processing failed",
				map[string]interface{}{"error": err.Error()}, requestID)
			return
		}
	default:
		h.sendError(c, http.StatusInternalServerError, "UNSUPPORTED_METHOD", "Unsupported processing method",
			map[string]interface{}{"method": processingMethod}, requestID)
		return
	}

	// Count successes and errors
	for _, result := range results {
		if result != nil {
			successCount++
		} else {
			errorCount++
		}
	}

	response := &AnalyzeBatchResponse{
		Results:          results,
		ProcessingMethod: string(processingMethod),
		RequestID:        requestID,
		ProcessedAt:      time.Now(),
		TotalProcessed:   len(req.Transactions),
		SuccessCount:     successCount,
		ErrorCount:       errorCount,
	}

	c.JSON(http.StatusOK, response)
}

// Helper methods

// determineProcessingMethod determines the optimal processing method for a single transaction
func (h *Handler) determineProcessingMethod(ctx context.Context, transaction *models.TransactionData, options *AnalysisOptions) (interfaces.ProcessingMethod, error) {
	// Check for forced processing method
	if options != nil {
		if options.ForceQuantum && options.ForceClassical {
			return "", errors.New("cannot force both quantum and classical processing")
		}
		if options.ForceQuantum {
			return interfaces.ProcessingMethodQuantum, nil
		}
		if options.ForceClassical {
			return interfaces.ProcessingMethodClassical, nil
		}
	}

	// Use intelligent router to determine method
	return h.router.RouteTransaction(ctx, transaction)
}

// determineBatchProcessingMethod determines the optimal processing method for batch processing
func (h *Handler) determineBatchProcessingMethod(ctx context.Context, transactions []*models.TransactionData, options *AnalysisOptions) (interfaces.ProcessingMethod, error) {
	// Check for forced processing method
	if options != nil {
		if options.ForceQuantum && options.ForceClassical {
			return "", errors.New("cannot force both quantum and classical processing")
		}
		if options.ForceQuantum {
			return interfaces.ProcessingMethodQuantum, nil
		}
		if options.ForceClassical {
			return interfaces.ProcessingMethodClassical, nil
		}
	}

	// For batch processing, use quantum if any transaction would benefit
	// This is a simplified heuristic - in production, this would be more sophisticated
	quantumCount := 0
	for _, transaction := range transactions {
		method, err := h.router.RouteTransaction(ctx, transaction)
		if err != nil {
			continue // Skip routing errors for individual transactions in batch
		}
		if method == interfaces.ProcessingMethodQuantum {
			quantumCount++
		}
	}

	// Use quantum if more than 30% of transactions would benefit
	if float64(quantumCount)/float64(len(transactions)) > 0.3 {
		return interfaces.ProcessingMethodQuantum, nil
	}

	return interfaces.ProcessingMethodClassical, nil
}

// processBatchClassical processes a batch using classical methods
func (h *Handler) processBatchClassical(ctx context.Context, transactions []*models.TransactionData) ([]*models.FraudResult, error) {
	results := make([]*models.FraudResult, len(transactions))

	for i, transaction := range transactions {
		classicalResult, err := h.fraudService.AnalyzeTransactionClassical(ctx, transaction)
		if err != nil {
			// Continue processing other transactions even if one fails
			results[i] = nil
			continue
		}
		results[i] = h.convertClassicalToFraudResult(classicalResult)
	}

	return results, nil
}

// convertClassicalToFraudResult converts a classical result to a standard fraud result
func (h *Handler) convertClassicalToFraudResult(classicalResult *interfaces.ClassicalFraudResult) *models.FraudResult {
	result := &models.FraudResult{
		TransactionID:    classicalResult.TransactionID,
		FraudScore:       classicalResult.FraudScore,
		RiskLevel:        models.RiskLevel(classicalResult.RiskLevel),
		ProcessingMethod: models.ProcessingMethodClassical,
		Confidence:       classicalResult.Confidence,
		ProcessingTimeMs: classicalResult.ProcessingTimeMs,
		Explanation:      classicalResult.Explanation,
		ModelVersion:     classicalResult.ModelVersion,
	}

	// Calculate risk level based on fraud score
	result.RiskLevel = result.CalculateRiskLevel()

	return result
}

// sendError sends a standardized error response
func (h *Handler) sendError(c *gin.Context, statusCode int, errorCode, message string, details map[string]interface{}, requestID string) {
	errorResponse := &ErrorResponse{
		ErrorCode: errorCode,
		Message:   message,
		Details:   details,
		Timestamp: time.Now(),
		RequestID: requestID,
	}
	c.JSON(statusCode, errorResponse)
}

// generateRequestID generates a unique request ID
func generateRequestID() string {
	// Simple implementation - in production, use UUID or similar
	return fmt.Sprintf("req_%d", time.Now().UnixNano())
}

// DetectFraudRingsRequest represents the request for fraud ring detection
type DetectFraudRingsRequest struct {
	Transactions []*models.TransactionData `json:"transactions" validate:"required,min=1,max=10000"`
	TimeWindow   *TimeWindowRequest        `json:"time_window,omitempty"`
	Options      *FraudRingOptions         `json:"options,omitempty"`
}

// TimeWindowRequest represents a time window for analysis
type TimeWindowRequest struct {
	Start time.Time `json:"start" validate:"required"`
	End   time.Time `json:"end" validate:"required"`
}

// FraudRingOptions represents options for fraud ring detection
type FraudRingOptions struct {
	MinRingSize          int     `json:"min_ring_size,omitempty" validate:"omitempty,min=2,max=50"`
	FraudThreshold       float64 `json:"fraud_threshold,omitempty" validate:"omitempty,min=0,max=1"`
	EnableQuantum        bool    `json:"enable_quantum,omitempty"`
	EnableRealTimeAlerts bool    `json:"enable_real_time_alerts,omitempty"`
}

// DetectFraudRingsResponse represents the response for fraud ring detection
type DetectFraudRingsResponse struct {
	Result           *interfaces.QuantumCommunityResult `json:"result"`
	ProcessingMethod string                             `json:"processing_method"`
	RequestID        string                             `json:"request_id"`
	ProcessedAt      time.Time                          `json:"processed_at"`
	GraphStats       *GraphStatistics                   `json:"graph_stats"`
}

// GraphStatistics provides statistics about the analyzed graph
type GraphStatistics struct {
	NodeCount           int     `json:"node_count"`
	EdgeCount           int     `json:"edge_count"`
	UserCount           int     `json:"user_count"`
	MerchantCount       int     `json:"merchant_count"`
	TransactionCount    int     `json:"transaction_count"`
	AverageConnectivity float64 `json:"average_connectivity"`
}

// DetectFraudRings handles POST /v1/fraud-rings/detect for fraud ring detection
func (h *Handler) DetectFraudRings(c *gin.Context) {
	requestID := generateRequestID()
	c.Header("X-Request-ID", requestID)

	var req DetectFraudRingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.sendError(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request format",
			map[string]interface{}{"validation_error": err.Error()}, requestID)
		return
	}

	// Validate request
	if err := h.validator.Struct(&req); err != nil {
		h.sendError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Request validation failed",
			map[string]interface{}{"validation_errors": err.Error()}, requestID)
		return
	}

	// Validate each transaction
	for i, transaction := range req.Transactions {
		if err := transaction.Validate(); err != nil {
			h.sendError(c, http.StatusBadRequest, "INVALID_TRANSACTION", "Transaction validation failed",
				map[string]interface{}{
					"transaction_index": i,
					"transaction_id":    transaction.TransactionID,
					"error":             err.Error(),
				}, requestID)
			return
		}
	}

	// Set default time window if not provided
	timeWindow := TimeWindow{
		Start: time.Now().Add(-24 * time.Hour), // Last 24 hours
		End:   time.Now(),
	}

	if req.TimeWindow != nil {
		timeWindow.Start = req.TimeWindow.Start
		timeWindow.End = req.TimeWindow.End

		// Validate time window
		if timeWindow.End.Before(timeWindow.Start) {
			h.sendError(c, http.StatusBadRequest, "INVALID_TIME_WINDOW", "End time must be after start time",
				nil, requestID)
			return
		}
	}

	// Set timeout context
	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	// Create fraud ring detector
	quantumBackend := NewQuantumBackendService()
	alertService := NewSimpleAlertService()
	fraudRingDetector := NewFraudRingDetector(quantumBackend, alertService)

	// Apply options if provided
	if req.Options != nil {
		if req.Options.MinRingSize > 0 {
			fraudRingDetector.config.MinRingSize = req.Options.MinRingSize
		}
		if req.Options.FraudThreshold > 0 {
			fraudRingDetector.config.FraudThreshold = req.Options.FraudThreshold
		}
		fraudRingDetector.config.QuantumOptimization = req.Options.EnableQuantum
		fraudRingDetector.config.RealTimeEnabled = req.Options.EnableRealTimeAlerts
	}

	// Detect fraud rings
	result, err := fraudRingDetector.DetectFraudRings(ctx, req.Transactions, timeWindow)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, "FRAUD_RING_DETECTION_ERROR", "Fraud ring detection failed",
			map[string]interface{}{"error": err.Error()}, requestID)
		return
	}

	// Calculate graph statistics
	graphStats := h.calculateGraphStatistics(req.Transactions, timeWindow)

	// Determine processing method
	processingMethod := "classical"
	if req.Options != nil && req.Options.EnableQuantum && len(req.Transactions) <= 1000 {
		processingMethod = "quantum_enhanced"
	}

	response := &DetectFraudRingsResponse{
		Result:           result,
		ProcessingMethod: processingMethod,
		RequestID:        requestID,
		ProcessedAt:      time.Now(),
		GraphStats:       graphStats,
	}

	c.JSON(http.StatusOK, response)
}

// calculateGraphStatistics calculates statistics about the transaction graph
func (h *Handler) calculateGraphStatistics(transactions []*models.TransactionData, timeWindow TimeWindow) *GraphStatistics {
	users := make(map[string]bool)
	merchants := make(map[string]bool)
	filteredTransactions := 0

	for _, tx := range transactions {
		if tx.Timestamp.After(timeWindow.Start) && tx.Timestamp.Before(timeWindow.End) {
			users[tx.UserID] = true
			merchants[tx.MerchantID] = true
			filteredTransactions++
		}
	}

	nodeCount := len(users) + len(merchants)
	edgeCount := filteredTransactions // Each transaction is an edge

	// Calculate average connectivity (simplified)
	averageConnectivity := 0.0
	if nodeCount > 0 {
		averageConnectivity = float64(edgeCount) / float64(nodeCount)
	}

	return &GraphStatistics{
		NodeCount:           nodeCount,
		EdgeCount:           edgeCount,
		UserCount:           len(users),
		MerchantCount:       len(merchants),
		TransactionCount:    filteredTransactions,
		AverageConnectivity: averageConnectivity,
	}
}
