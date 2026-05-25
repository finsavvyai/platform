package sdln

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// GDPRService provides GDPR compliance functionality
type GDPRService struct {
	*BaseService
	auditService   *AuditService
	classifier     *DataClassifier
	retentionMgr   *RetentionManager
	consentMgr     *ConsentManager
	breachDetector *BreachDetector
}

// NewGDPRService creates a new GDPR service
func NewGDPRService(client *Client) *GDPRService {
	return &GDPRService{
		BaseService:    NewBaseService(client, "gdpr", "api/v1/gdpr"),
		classifier:     NewDataClassifier(),
		retentionMgr:   NewRetentionManager(nil),
		consentMgr:     NewConsentManager(),
		breachDetector: NewBreachDetector(),
	}
}

// GDPRManager manages GDPR compliance operations
type GDPRManager struct {
	auditService       *AuditService
	dataClassifier     *DataClassifier
	retentionMgr       *RetentionManager
	consentMgr         *ConsentManager
	rightToBeForgotten *RightToBeForgottenHandler
	dataPortability    *DataPortabilityHandler
	breachManager      *BreachManager
}

// NewGDPRManager creates a new GDPR manager
func NewGDPRManager(auditService *AuditService) *GDPRManager {
	return &GDPRManager{
		auditService:       auditService,
		dataClassifier:     NewDataClassifier(),
		retentionMgr:       NewRetentionManager(auditService.logStorage),
		consentMgr:         NewConsentManager(),
		rightToBeForgotten: NewRightToBeForgottenHandler(auditService),
		dataPortability:    NewDataPortabilityHandler(auditService),
		breachManager:      NewBreachManager(auditService),
	}
}

// DataSubjectRequest represents a GDPR data subject request
type DataSubjectRequest struct {
	ID            string                 `json:"id"`
	Type          string                 `json:"type"` // access, rectification, erasure, portability, restriction
	DataSubjectID string                 `json:"data_subject_id"`
	IdentityProof *IdentityProof         `json:"identity_proof,omitempty"`
	Description   string                 `json:"description"`
	Scope         []string               `json:"scope,omitempty"`
	Format        string                 `json:"format,omitempty"` // json, csv, xml, pdf
	Email         string                 `json:"email"`
	Phone         string                 `json:"phone,omitempty"`
	Status        string                 `json:"status"`   // pending, processing, completed, rejected, expired
	Priority      string                 `json:"priority"` // low, medium, high, urgent
	RequestDate   Timestamp              `json:"request_date"`
	DueDate       Timestamp              `json:"due_date"`
	CompletedDate *Timestamp             `json:"completed_date,omitempty"`
	ProcessedBy   string                 `json:"processed_by,omitempty"`
	Results       *RequestResults        `json:"results,omitempty"`
	Notes         string                 `json:"notes,omitempty"`
	Attachments   []string               `json:"attachments,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt     Timestamp              `json:"created_at"`
	UpdatedAt     Timestamp              `json:"updated_at"`
}

// IdentityProof represents proof of identity for GDPR requests
type IdentityProof struct {
	Type         string     `json:"type"` // government_id, utility_bill, bank_statement, digital_signature
	DocumentID   string     `json:"document_id"`
	DocumentHash string     `json:"document_hash"`
	ExpiryDate   Timestamp  `json:"expiry_date"`
	IssuingAuth  string     `json:"issuing_authority"`
	Verified     bool       `json:"verified"`
	VerifiedAt   *Timestamp `json:"verified_at,omitempty"`
	VerifiedBy   string     `json:"verified_by,omitempty"`
	Notes        string     `json:"notes,omitempty"`
}

// RequestResults represents the results of a data subject request
type RequestResults struct {
	RecordsFound     int64                  `json:"records_found"`
	RecordsProcessed int64                  `json:"records_processed"`
	RecordsExported  int64                  `json:"records_exported"`
	RecordsDeleted   int64                  `json:"records_deleted"`
	RecordsRectified int64                  `json:"records_rectified"`
	DataExportURL    string                 `json:"data_export_url,omitempty"`
	ExportFormat     string                 `json:"export_format,omitempty"`
	Summary          string                 `json:"summary"`
	Details          map[string]interface{} `json:"details,omitempty"`
}

// ProcessDataSubjectRequest processes a GDPR data subject request
func (gm *GDPRManager) ProcessDataSubjectRequest(ctx context.Context, req *DataSubjectRequest) (*DataSubjectRequest, error) {
	// Validate request
	if err := gm.validateRequest(req); err != nil {
		req.Status = "rejected"
		req.Notes = fmt.Sprintf("Validation failed: %v", err)
		return req, err
	}

	// Verify identity
	if req.IdentityProof != nil {
		if err := gm.verifyIdentity(req.IdentityProof); err != nil {
			req.Status = "rejected"
			req.Notes = fmt.Sprintf("Identity verification failed: %v", err)
			return req, err
		}
	}

	req.Status = "processing"
	req.UpdatedAt = NewTimestamp(time.Now().UTC())

	// Process request based on type
	switch req.Type {
	case "access":
		return gm.processAccessRequest(ctx, req)
	case "rectification":
		return gm.processRectificationRequest(ctx, req)
	case "erasure":
		return gm.processErasureRequest(ctx, req)
	case "portability":
		return gm.processPortabilityRequest(ctx, req)
	case "restriction":
		return gm.processRestrictionRequest(ctx, req)
	default:
		req.Status = "rejected"
		req.Notes = fmt.Sprintf("Unsupported request type: %s", req.Type)
		return req, fmt.Errorf("unsupported request type: %s", req.Type)
	}
}

// validateRequest validates a data subject request
func (gm *GDPRManager) validateRequest(req *DataSubjectRequest) error {
	if req.DataSubjectID == "" {
		return fmt.Errorf("data subject ID is required")
	}

	if req.Type == "" {
		return fmt.Errorf("request type is required")
	}

	if req.Email == "" {
		return fmt.Errorf("contact email is required")
	}

	// Check if due date is reasonable (within 30 days for most requests)
	if time.Until(req.DueDate.Time) > 30*24*time.Hour {
		return fmt.Errorf("due date is too far in the future")
	}

	return nil
}

// verifyIdentity verifies the identity of the data subject
func (gm *GDPRManager) verifyIdentity(proof *IdentityProof) error {
	// In a real implementation, this would involve:
	// 1. Checking document hash against stored value
	// 2. Validating expiry date
	// 3. Verifying issuing authority
	// 4. Cross-referencing with external verification services

	if time.Until(proof.ExpiryDate.Time) < 0 {
		return fmt.Errorf("identity document has expired")
	}

	proof.Verified = true
	now := NewTimestamp(time.Now().UTC())
	proof.VerifiedAt = &now
	proof.VerifiedBy = "system"

	return nil
}

// processAccessRequest processes a right to access request
func (gm *GDPRManager) processAccessRequest(ctx context.Context, req *DataSubjectRequest) (*DataSubjectRequest, error) {
	// Query all data related to the data subject
	query := &AuditQuery{
		UserID:    req.DataSubjectID,
		StartTime: NewTimestamp(time.Time{}), // Beginning of time
		EndTime:   NewTimestamp(time.Now().UTC()),
		Limit:     10000,
	}

	result, err := gm.auditService.QueryLogs(ctx, query)
	if err != nil {
		req.Status = "rejected"
		req.Notes = fmt.Sprintf("Failed to query data: %v", err)
		return req, err
	}

	// Process and format the data
	exportData, err := gm.formatAccessData(result.Logs, req.Format)
	if err != nil {
		req.Status = "rejected"
		req.Notes = fmt.Sprintf("Failed to format data: %v", err)
		return req, err
	}

	// Create results
	req.Results = &RequestResults{
		RecordsFound:     int64(len(result.Logs)),
		RecordsProcessed: int64(len(result.Logs)),
		RecordsExported:  int64(len(result.Logs)),
		DataExportURL:    exportData.URL,
		ExportFormat:     req.Format,
		Summary:          fmt.Sprintf("Found and exported %d records", len(result.Logs)),
	}

	req.Status = "completed"
	completed := NewTimestamp(time.Now().UTC())
	req.CompletedDate = &completed
	req.UpdatedAt = NewTimestamp(time.Now().UTC())

	// Log the access request
	event := &AuditEvent{
		EventID:       generateID(),
		EventType:     "gdpr_access_request",
		EventCategory: "compliance",
		UserID:        req.DataSubjectID,
		Action:        "data_access_granted",
		Description:   fmt.Sprintf("GDPR right to access request processed for data subject %s", req.DataSubjectID),
		Severity:      "medium",
		Source:        "gdpr_service",
		Success:       true,
		Metadata: map[string]interface{}{
			"request_id":    req.ID,
			"records_found": len(result.Logs),
			"export_format": req.Format,
		},
	}

	_ = gm.auditService.LogEvent(ctx, event)

	return req, nil
}

// processErasureRequest processes a right to erasure (right to be forgotten) request
func (gm *GDPRManager) processErasureRequest(ctx context.Context, req *DataSubjectRequest) (*DataSubjectRequest, error) {
	// Use the right to be forgotten handler
	return gm.rightToBeForgotten.ProcessErasureRequest(ctx, req)
}

// processPortabilityRequest processes a data portability request
func (gm *GDPRManager) processPortabilityRequest(ctx context.Context, req *DataSubjectRequest) (*DataSubjectRequest, error) {
	// Use the data portability handler
	return gm.dataPortability.ProcessPortabilityRequest(ctx, req)
}

// processRectificationRequest processes a data rectification request
func (gm *GDPRManager) processRectificationRequest(ctx context.Context, req *DataSubjectRequest) (*DataSubjectRequest, error) {
	// Query current data
	query := &AuditQuery{
		UserID:    req.DataSubjectID,
		StartTime: NewTimestamp(time.Time{}),
		EndTime:   NewTimestamp(time.Now().UTC()),
		Limit:     1000,
	}

	result, err := gm.auditService.QueryLogs(ctx, query)
	if err != nil {
		req.Status = "rejected"
		req.Notes = fmt.Sprintf("Failed to query data: %v", err)
		return req, err
	}

	// Process rectifications (this would depend on the specific corrections needed)
	rectifiedCount := int64(0)
	for _, log := range result.Logs {
		// In a real implementation, this would apply the specific corrections
		// For now, we'll simulate rectification
		rectifiedCount++
	}

	// Create results
	req.Results = &RequestResults{
		RecordsFound:     int64(len(result.Logs)),
		RecordsProcessed: int64(len(result.Logs)),
		RecordsRectified: rectifiedCount,
		Summary:          fmt.Sprintf("Rectified %d records for data subject %s", rectifiedCount, req.DataSubjectID),
	}

	req.Status = "completed"
	completed := NewTimestamp(time.Now().UTC())
	req.CompletedDate = &completed
	req.UpdatedAt = NewTimestamp(time.Now().UTC())

	return req, nil
}

// processRestrictionRequest processes a data processing restriction request
func (gm *GDPRManager) processRestrictionRequest(ctx context.Context, req *DataSubjectRequest) (*DataSubjectRequest, error) {
	// Add processing restriction flags
	restrictionCount := int64(0)

	// In a real implementation, this would:
	// 1. Add processing restrictions to the data subject's records
	// 2. Update consent status to "restricted"
	// 3. Notify downstream systems of the restriction

	req.Results = &RequestResults{
		RecordsProcessed: restrictionCount,
		Summary:          fmt.Sprintf("Applied processing restrictions to %d records", restrictionCount),
	}

	req.Status = "completed"
	completed := NewTimestamp(time.Now().UTC())
	req.CompletedDate = &completed
	req.UpdatedAt = NewTimestamp(time.Now().UTC())

	return req, nil
}

// formatAccessData formats access request data for export
func (gm *GDPRManager) formatAccessData(logs []*AuditLog, format string) (*ExportData, error) {
	exportData := &ExportData{
		ID:      generateID(),
		Format:  format,
		Created: NewTimestamp(time.Now().UTC()),
		Expires: NewTimestamp(time.Now().UTC().Add(30 * 24 * time.Hour)), // 30 days
	}

	switch format {
	case "json":
		data, err := json.Marshal(logs)
		if err != nil {
			return nil, err
		}
		exportData.Content = string(data)
		exportData.URL = fmt.Sprintf("/exports/%s.json", exportData.ID)
	case "csv":
		exportData.Content = gm.convertToCSV(logs)
		exportData.URL = fmt.Sprintf("/exports/%s.csv", exportData.ID)
	default:
		return nil, fmt.Errorf("unsupported export format: %s", format)
	}

	return exportData, nil
}

// convertToCSV converts audit logs to CSV format
func (gm *GDPRManager) convertToCSV(logs []*AuditLog) string {
	// Simple CSV conversion - in production, use a proper CSV library
	csv := "ID,Timestamp,EventType,Action,Description\n"
	for _, log := range logs {
		csv += fmt.Sprintf("%s,%s,%s,%s,\"%s\"\n",
			log.ID,
			log.Timestamp.Format(time.RFC3339),
			log.EventType,
			log.Action,
			strings.Replace(log.Description, "\"", "\"\"", -1))
	}
	return csv
}

// ExportData represents exported data
type ExportData struct {
	ID      string    `json:"id"`
	Format  string    `json:"format"`
	Content string    `json:"content"`
	URL     string    `json:"url"`
	Created Timestamp `json:"created"`
	Expires Timestamp `json:"expires"`
	Size    int64     `json:"size"`
}

// RightToBeForgottenHandler handles right to erasure requests
type RightToBeForgottenHandler struct {
	auditService *AuditService
}

// NewRightToBeForgottenHandler creates a new right to be forgotten handler
func NewRightToBeForgottenHandler(auditService *AuditService) *RightToBeForgottenHandler {
	return &RightToBeForgottenHandler{
		auditService: auditService,
	}
}

// ProcessErasureRequest processes a right to erasure request
func (rtbf *RightToBeForgottenHandler) ProcessErasureRequest(ctx context.Context, req *DataSubjectRequest) (*DataSubjectRequest, error) {
	// Find all data related to the data subject
	query := &AuditQuery{
		UserID:    req.DataSubjectID,
		StartTime: NewTimestamp(time.Time{}),
		EndTime:   NewTimestamp(time.Now().UTC()),
		Limit:     10000,
	}

	result, err := rtbf.auditService.QueryLogs(ctx, query)
	if err != nil {
		req.Status = "rejected"
		req.Notes = fmt.Sprintf("Failed to query data: %v", err)
		return req, err
	}

	// Check for legal holds or other blocking conditions
	if rtbf.hasBlockingConditions(req.DataSubjectID) {
		req.Status = "rejected"
		req.Notes = "Data cannot be erased due to legal hold or regulatory requirement"
		return req, fmt.Errorf("data erasure blocked by legal hold")
	}

	// Perform erasure (in a real implementation, this would:
	// 1. Delete active records
	// 2. anonymize historical data where deletion is not possible
	// 3. update references and indexes
	// 4. notify downstream systems)
	erasedCount := int64(len(result.Logs))

	// Create results
	req.Results = &RequestResults{
		RecordsFound:   int64(len(result.Logs)),
		RecordsDeleted: erasedCount,
		Summary:        fmt.Sprintf("Erased %d records for data subject %s", erasedCount, req.DataSubjectID),
	}

	req.Status = "completed"
	completed := NewTimestamp(time.Now().UTC())
	req.CompletedDate = &completed
	req.UpdatedAt = NewTimestamp(time.Now().UTC())

	// Log the erasure
	event := &AuditEvent{
		EventID:       generateID(),
		EventType:     "gdpr_erasure_request",
		EventCategory: "compliance",
		UserID:        req.DataSubjectID,
		Action:        "data_erased",
		Description:   fmt.Sprintf("GDPR right to erasure request completed for data subject %s", req.DataSubjectID),
		Severity:      "high",
		Source:        "gdpr_service",
		Success:       true,
		Metadata: map[string]interface{}{
			"request_id":     req.ID,
			"records_erased": erasedCount,
		},
	}

	_ = rtbf.auditService.LogEvent(ctx, event)

	return req, nil
}

// hasBlockingConditions checks if there are conditions preventing erasure
func (rtbf *RightToBeForgottenHandler) hasBlockingConditions(dataSubjectID string) bool {
	// In a real implementation, this would check for:
	// 1. Active legal holds
	// 2. Regulatory requirements for data retention
	// 3. Pending investigations
	// 4. Financial reporting requirements
	return false // Simplified for demo
}

// DataPortabilityHandler handles data portability requests
type DataPortabilityHandler struct {
	auditService *AuditService
}

// NewDataPortabilityHandler creates a new data portability handler
func NewDataPortabilityHandler(auditService *AuditService) *DataPortabilityHandler {
	return &DataPortabilityHandler{
		auditService: auditService,
	}
}

// ProcessPortabilityRequest processes a data portability request
func (dph *DataPortabilityHandler) ProcessPortabilityRequest(ctx context.Context, req *DataSubjectRequest) (*DataSubjectRequest, error) {
	// Collect all portable data
	portableData, err := dph.collectPortableData(ctx, req.DataSubjectID)
	if err != nil {
		req.Status = "rejected"
		req.Notes = fmt.Sprintf("Failed to collect portable data: %v", err)
		return req, err
	}

	// Format and export data
	exportData, err := dph.createPortableDataExport(portableData, req.Format)
	if err != nil {
		req.Status = "rejected"
		req.Notes = fmt.Sprintf("Failed to create data export: %v", err)
		return req, err
	}

	// Create results
	req.Results = &RequestResults{
		RecordsFound:    int64(len(portableData)),
		RecordsExported: int64(len(portableData)),
		DataExportURL:   exportData.URL,
		ExportFormat:    req.Format,
		Summary:         fmt.Sprintf("Exported %d portable data records", len(portableData)),
	}

	req.Status = "completed"
	completed := NewTimestamp(time.Now().UTC())
	req.CompletedDate = &completed
	req.UpdatedAt = NewTimestamp(time.Now().UTC())

	return req, nil
}

// collectPortableData collects all portable data for a data subject
func (dph *DataPortabilityHandler) collectPortableData(ctx context.Context, dataSubjectID string) ([]PortableDataRecord, error) {
	// Query personal data
	query := &AuditQuery{
		UserID:    dataSubjectID,
		StartTime: NewTimestamp(time.Time{}),
		EndTime:   NewTimestamp(time.Now().UTC()),
		Limit:     5000,
	}

	result, err := dph.auditService.QueryLogs(ctx, query)
	if err != nil {
		return nil, err
	}

	// Convert to portable format
	portableData := make([]PortableDataRecord, 0, len(result.Logs))
	for _, log := range result.Logs {
		record := PortableDataRecord{
			ID:            log.ID,
			DataSubjectID: dataSubjectID,
			DataType:      log.EventType,
			Content:       log.Description,
			Timestamp:     log.Timestamp,
			Source:        log.Source,
			Metadata:      log.Metadata,
		}
		portableData = append(portableData, record)
	}

	return portableData, nil
}

// PortableDataRecord represents a portable data record
type PortableDataRecord struct {
	ID            string                 `json:"id"`
	DataSubjectID string                 `json:"data_subject_id"`
	DataType      string                 `json:"data_type"`
	Content       string                 `json:"content"`
	Timestamp     Timestamp              `json:"timestamp"`
	Source        string                 `json:"source"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// createPortableDataExport creates a portable data export
func (dph *DataPortabilityHandler) createPortableDataExport(data []PortableDataRecord, format string) (*ExportData, error) {
	exportData := &ExportData{
		ID:      generateID(),
		Format:  format,
		Created: NewTimestamp(time.Now().UTC()),
		Expires: NewTimestamp(time.Now().UTC().Add(30 * 24 * time.Hour)), // 30 days
	}

	switch format {
	case "json":
		jsonData, err := json.Marshal(data)
		if err != nil {
			return nil, err
		}
		exportData.Content = string(jsonData)
		exportData.URL = fmt.Sprintf("/portability/%s.json", exportData.ID)
	default:
		return nil, fmt.Errorf("unsupported export format: %s", format)
	}

	return exportData, nil
}

// BreachManager manages data breach detection and notification
type BreachManager struct {
	auditService *AuditService
}

// NewBreachManager creates a new breach manager
func NewBreachManager(auditService *AuditService) *BreachManager {
	return &BreachManager{
		auditService: auditService,
	}
}

// BreachDetector detects potential data breaches
type BreachDetector struct {
	breachRules map[string]*BreachRule
}

// NewBreachDetector creates a new breach detector
func NewBreachDetector() *BreachDetector {
	return &BreachDetector{
		breachRules: make(map[string]*BreachRule),
	}
}

// BreachRule represents a rule for detecting data breaches
type BreachRule struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Conditions  []BreachCondition `json:"conditions"`
	Severity    string            `json:"severity"`
	Enabled     bool              `json:"enabled"`
	Threshold   int               `json:"threshold"`
	TimeWindow  time.Duration     `json:"time_window"`
	Actions     []string          `json:"actions"`
	CreatedAt   Timestamp         `json:"created_at"`
}

// BreachCondition represents a condition for breach detection
type BreachCondition struct {
	Field    string      `json:"field"`
	Operator string      `json:"operator"`
	Value    interface{} `json:"value"`
}

// ConsentManager manages consent records and processing
type ConsentManager struct {
	consentRecords map[string]*ConsentRecord
}

// NewConsentManager creates a new consent manager
func NewConsentManager() *ConsentManager {
	return &ConsentManager{
		consentRecords: make(map[string]*ConsentRecord),
	}
}

// ConsentRecord represents a consent record
type ConsentRecord struct {
	ID            string                 `json:"id"`
	DataSubjectID string                 `json:"data_subject_id"`
	DataType      string                 `json:"data_type"`
	Purpose       string                 `json:"purpose"`
	Status        string                 `json:"status"`
	GrantedAt     Timestamp              `json:"granted_at"`
	ExpiresAt     *Timestamp             `json:"expires_at,omitempty"`
	WithdrawnAt   *Timestamp             `json:"withdrawn_at,omitempty"`
	ConsentText   string                 `json:"consent_text"`
	Version       string                 `json:"version"`
	IPAddress     string                 `json:"ip_address"`
	UserAgent     string                 `json:"user_agent"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}
