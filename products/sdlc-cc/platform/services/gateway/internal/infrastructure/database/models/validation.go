package models

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"
)

var validate *validator.Validate

func init() {
	validate = validator.New()

	// Register custom validation rules; panic on registration error since this
	// is a programming/setup error that must not be silently ignored.
	rules := []struct {
		tag string
		fn  validator.Func
	}{
		{"tenant_status", validateTenantStatus},
		{"user_role", validateUserRole},
		{"document_status", validateDocumentStatus},
		{"policy_type", validatePolicyType},
		{"encryption_algorithm", validateEncryptionAlgorithm},
		{"data_classification", validateDataClassification},
		{"audit_action", validateAuditAction},
		{"domain_format", validateDomainFormat},
		{"secure_password", validateSecurePassword},
	}
	for _, r := range rules {
		if err := validate.RegisterValidation(r.tag, r.fn); err != nil {
			panic(fmt.Sprintf("validator: failed to register %q: %v", r.tag, err))
		}
	}
}

// Custom validation functions

func validateTenantStatus(fl validator.FieldLevel) bool {
	status := fl.Field().String()
	validStatuses := []string{"active", "suspended", "trial", "deleted"}
	for _, valid := range validStatuses {
		if status == valid {
			return true
		}
	}
	return false
}

func validateUserRole(fl validator.FieldLevel) bool {
	role := fl.Field().String()
	validRoles := []string{"super_admin", "tenant_admin", "data_scientist", "analyst", "viewer", "user"}
	for _, valid := range validRoles {
		if role == valid {
			return true
		}
	}
	return false
}

func validateDocumentStatus(fl validator.FieldLevel) bool {
	status := fl.Field().String()
	validStatuses := []string{"pending", "processing", "completed", "failed"}
	for _, valid := range validStatuses {
		if status == valid {
			return true
		}
	}
	return false
}

func validatePolicyType(fl validator.FieldLevel) bool {
	policyType := fl.Field().String()
	validTypes := []string{"auth", "data_access", "dlp", "cost", "compliance"}
	for _, valid := range validTypes {
		if policyType == valid {
			return true
		}
	}
	return false
}

func validateEncryptionAlgorithm(fl validator.FieldLevel) bool {
	algorithm := fl.Field().String()
	validAlgorithms := []string{"aes-256-gcm", "aes-256-cbc", "chacha20-poly1305"}
	for _, valid := range validAlgorithms {
		if algorithm == valid {
			return true
		}
	}
	return false
}

func validateDataClassification(fl validator.FieldLevel) bool {
	classification := fl.Field().String()
	validClassifications := []string{"public", "internal", "confidential", "restricted"}
	for _, valid := range validClassifications {
		if classification == valid {
			return true
		}
	}
	return false
}

func validateAuditAction(fl validator.FieldLevel) bool {
	action := fl.Field().String()
	validActions := []string{"create", "read", "update", "delete", "login", "logout", "access_denied"}
	for _, valid := range validActions {
		if action == valid {
			return true
		}
	}
	return false
}

func validateDomainFormat(fl validator.FieldLevel) bool {
	domain := fl.Field().String()
	if len(domain) == 0 {
		return false
	}

	// Basic domain validation
	domainRegex := regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$`)
	return domainRegex.MatchString(domain)
}

func validateSecurePassword(fl validator.FieldLevel) bool {
	password := fl.Field().String()
	if len(password) < 12 {
		return false
	}

	// Check for at least one uppercase, one lowercase, one number, and one special character
	hasUpper := regexp.MustCompile(`[A-Z]`).MatchString(password)
	hasLower := regexp.MustCompile(`[a-z]`).MatchString(password)
	hasNumber := regexp.MustCompile(`[0-9]`).MatchString(password)
	hasSpecial := regexp.MustCompile(`[!@#$%^&*(),.?":{}|<>]`).MatchString(password)

	return hasUpper && hasLower && hasNumber && hasSpecial
}

// Validation methods for models

// Validate validates the Tenant struct
func (t *Tenant) Validate() error {
	if err := validate.Struct(t); err != nil {
		return fmt.Errorf("tenant validation failed: %w", err)
	}
	return nil
}

// Validate validates the User struct
func (u *User) Validate() error {
	if err := validate.Struct(u); err != nil {
		return fmt.Errorf("user validation failed: %w", err)
	}

	// Additional business logic validations
	if u.FailedLoginAttempts < 0 {
		return fmt.Errorf("failed login attempts cannot be negative")
	}

	if u.LockedUntil != nil && u.LastLogin != nil {
		if u.LockedUntil.Before(*u.LastLogin) {
			return fmt.Errorf("lock expiration cannot be before last login")
		}
	}

	return nil
}

// Validate validates the Document struct
func (d *Document) Validate() error {
	if err := validate.Struct(d); err != nil {
		return fmt.Errorf("document validation failed: %w", err)
	}

	// Additional business logic validations
	if d.FileSize <= 0 {
		return fmt.Errorf("file size must be positive")
	}

	if len(d.Checksum) != 64 {
		return fmt.Errorf("checksum must be 64 characters (SHA-256)")
	}

	if d.ProcessingDurationMs < 0 {
		return fmt.Errorf("processing duration cannot be negative")
	}

	return nil
}

// Validate validates the DocumentChunk struct
func (dc *DocumentChunk) Validate() error {
	if err := validate.Struct(dc); err != nil {
		return fmt.Errorf("document chunk validation failed: %w", err)
	}

	// Additional validations
	if dc.ContentLength != len(dc.Content) {
		return fmt.Errorf("content length does not match actual content length")
	}

	if dc.ChunkIndex < 0 {
		return fmt.Errorf("chunk index cannot be negative")
	}

	if dc.ProcessingTimeMs < 0 {
		return fmt.Errorf("processing time cannot be negative")
	}

	if len(dc.Checksum) != 64 {
		return fmt.Errorf("checksum must be 64 characters (SHA-256)")
	}

	return nil
}

// Validate validates the Policy struct
func (p *Policy) Validate() error {
	if err := validate.Struct(p); err != nil {
		return fmt.Errorf("policy validation failed: %w", err)
	}

	// Additional validations
	if p.Version <= 0 {
		return fmt.Errorf("policy version must be positive")
	}

	if p.Priority < 0 {
		return fmt.Errorf("policy priority cannot be negative")
	}

	if strings.TrimSpace(p.RegoPolicy) == "" {
		return fmt.Errorf("rego policy cannot be empty")
	}

	return nil
}

// Validate validates the APIKey struct
func (ak *APIKey) Validate() error {
	if err := validate.Struct(ak); err != nil {
		return fmt.Errorf("api key validation failed: %w", err)
	}

	// Additional validations
	if ak.MaxUsage > 0 && ak.UsageCount > ak.MaxUsage {
		return fmt.Errorf("usage count exceeds maximum usage limit")
	}

	if ak.RateLimit < 0 {
		return fmt.Errorf("rate limit cannot be negative")
	}

	if ak.ExpiresAt != nil && ak.ExpiresAt.Before(time.Now()) {
		return fmt.Errorf("api key cannot be expired at creation")
	}

	return nil
}

// Validate validates the TokenUsage struct
func (tu *TokenUsage) Validate() error {
	if err := validate.Struct(tu); err != nil {
		return fmt.Errorf("token usage validation failed: %w", err)
	}

	// Additional validations
	if tu.TokensUsed <= 0 {
		return fmt.Errorf("tokens used must be positive")
	}

	if tu.CostUsd < 0 {
		return fmt.Errorf("cost cannot be negative")
	}

	if tu.DurationMs < 0 {
		return fmt.Errorf("duration cannot be negative")
	}

	return nil
}

// Helper methods for business logic

// IsExpired checks if the API key is expired
func (ak *APIKey) IsExpired() bool {
	if ak.ExpiresAt == nil {
		return false
	}
	return time.Now().After(*ak.ExpiresAt)
}

// IsUsageExceeded checks if the API key has exceeded its usage limit
func (ak *APIKey) IsUsageExceeded() bool {
	if ak.MaxUsage <= 0 {
		return false
	}
	return ak.UsageCount >= ak.MaxUsage
}

// IsValid checks if the API key is currently valid
func (ak *APIKey) IsValid() bool {
	return ak.IsActive && !ak.IsExpired() && !ak.IsUsageExceeded()
}

// UpdateLastUsage updates the last used timestamp and usage count
func (ak *APIKey) UpdateLastUsage() {
	now := time.Now()
	ak.LastUsed = &now
	ak.UsageCount++
}

// IsLocked checks if the user account is locked
func (u *User) IsLocked() bool {
	if u.LockedUntil == nil {
		return false
	}
	return time.Now().Before(*u.LockedUntil)
}

// LockAccount locks the user account for the specified duration
func (u *User) LockAccount(duration time.Duration) {
	lockUntil := time.Now().Add(duration)
	u.LockedUntil = &lockUntil
}

// UnlockAccount unlocks the user account
func (u *User) UnlockAccount() {
	u.LockedUntil = nil
	u.FailedLoginAttempts = 0
}

// IncrementFailedLogin increments the failed login count
func (u *User) IncrementFailedLogin() {
	u.FailedLoginAttempts++
}

// ResetFailedLogin resets the failed login count
func (u *User) ResetFailedLogin() {
	u.FailedLoginAttempts = 0
}

// UpdateLastLogin updates the last login timestamp
func (u *User) UpdateLastLogin() {
	now := time.Now()
	u.LastLogin = &now
}

// IsProcessingComplete checks if document processing is complete
func (d *Document) IsProcessingComplete() bool {
	return d.ExtractionStatus == "completed" &&
		d.ProcessingStatus == "completed" &&
		d.DLPStatus == "completed"
}

// IsProcessing checks if document is currently being processed
func (d *Document) IsProcessing() bool {
	return d.ExtractionStatus == "processing" ||
		d.ProcessingStatus == "processing" ||
		d.DLPStatus == "processing"
}

// HasProcessingFailed checks if any document processing has failed
func (d *Document) HasProcessingFailed() bool {
	return d.ExtractionStatus == "failed" ||
		d.ProcessingStatus == "failed" ||
		d.DLPStatus == "failed"
}

// GetProcessingStatus returns overall processing status
func (d *Document) GetProcessingStatus() string {
	if d.IsProcessingComplete() {
		return "completed"
	}
	if d.HasProcessingFailed() {
		return "failed"
	}
	if d.IsProcessing() {
		return "processing"
	}
	return "pending"
}

// IsActivePolicy checks if the policy is currently active
func (p *Policy) IsActivePolicy() bool {
	return p.IsActive
}

// CanEvaluate checks if policy can be evaluated
func (p *Policy) CanEvaluate() bool {
	return p.IsActive && strings.TrimSpace(p.RegoPolicy) != ""
}

// AddTestCase adds a test case to the policy
func (p *Policy) AddTestCase(testCase map[string]interface{}) error {
	// This would require proper JSON marshaling/unmarshaling
	// For now, just validate that test case is not empty
	if len(testCase) == 0 {
		return fmt.Errorf("test case cannot be empty")
	}
	return nil
}

// HasEmbedding checks if chunk has embedding
func (dc *DocumentChunk) HasEmbedding() bool {
	return len(dc.Embedding) > 0
}

// NeedsEmbedding checks if chunk needs embedding
func (dc *DocumentChunk) NeedsEmbedding() bool {
	return dc.EmbeddingStatus == "pending" || dc.EmbeddingStatus == "failed"
}

// IsEmbeddingComplete checks if embedding processing is complete
func (dc *DocumentChunk) IsEmbeddingComplete() bool {
	return dc.EmbeddingStatus == "completed" && dc.HasEmbedding()
}

// UpdateEmbeddingStatus updates the embedding status
func (dc *DocumentChunk) UpdateEmbeddingStatus(status string, processingTime int) {
	dc.EmbeddingStatus = status
	dc.ProcessingTimeMs = processingTime
}

// EstimateTokenCount estimates the token count for the chunk
func (dc *DocumentChunk) EstimateTokenCount() {
	// Simple estimation: roughly 4 characters per token
	estimated := len(dc.Content) / 4
	dc.TokenCount = estimated
}

// IsActiveSession checks if the user session is active
func (us *UserSession) IsActiveSession() bool {
	return us.IsActive && time.Now().Before(us.ExpiresAt)
}

// IsExpired checks if the session is expired
func (us *UserSession) IsExpired() bool {
	return time.Now().After(us.ExpiresAt)
}

// ExtendSession extends the session expiration
func (us *UserSession) ExtendSession(duration time.Duration) {
	us.ExpiresAt = time.Now().Add(duration)
	us.LastUsed = time.Now()
}

// IsRetryable checks if the job can be retried
func (dpj *DocumentProcessingJob) IsRetryable() bool {
	return dpj.Status == "failed" && dpj.RetryCount < dpj.MaxRetries
}

// IncrementRetry increments the retry count
func (dpj *DocumentProcessingJob) IncrementRetry() {
	dpj.RetryCount++
}

// StartJob marks the job as started
func (dpj *DocumentProcessingJob) StartJob() {
	now := time.Now()
	dpj.StartedAt = &now
	dpj.Status = "processing"
}

// CompleteJob marks the job as completed
func (dpj *DocumentProcessingJob) CompleteJob() {
	now := time.Now()
	dpj.CompletedAt = &now
	dpj.Status = "completed"
	dpj.Progress = 100
}

// FailJob marks the job as failed
func (dpj *DocumentProcessingJob) FailJob(errorMsg string) {
	now := time.Now()
	dpj.CompletedAt = &now
	dpj.Status = "failed"
	dpj.Error = errorMsg
}

// HasPermission checks if user has specific permission
func (u *User) HasPermission(permission string) bool {
	// This would require proper JSON unmarshaling of permissions
	// For now, return true for admin roles
	return u.Role == "super_admin" || u.Role == "tenant_admin"
}

// IsAdmin checks if user has admin role
func (u *User) IsAdmin() bool {
	return u.Role == "super_admin" || u.Role == "tenant_admin"
}

// CanAccessTenant checks if user can access the tenant
func (u *User) CanAccessTenant(tenantID string) bool {
	return u.TenantID.String() == tenantID || u.Role == "super_admin"
}

// GetRetentionDays returns retention period in days
func (d *Document) GetRetentionDays() int {
	// This would require parsing the retention_policy JSON
	// For now, return a default
	return 365
}

// IsRetentionExpired checks if document has exceeded retention period
func (d *Document) IsRetentionExpired() bool {
	retentionDays := d.GetRetentionDays()
	expiryDate := d.CreatedAt.AddDate(0, 0, retentionDays)
	return time.Now().After(expiryDate)
}

// ShouldBeArchived checks if document should be archived
func (d *Document) ShouldBeArchived() bool {
	return d.IsRetentionExpired() || d.Classification == "restricted"
}

// GetComplianceLevel returns compliance level based on classification
func (d *Document) GetComplianceLevel() string {
	switch d.Classification {
	case "public":
		return "low"
	case "internal":
		return "medium"
	case "confidential":
		return "high"
	case "restricted":
		return "critical"
	default:
		return "medium"
	}
}
