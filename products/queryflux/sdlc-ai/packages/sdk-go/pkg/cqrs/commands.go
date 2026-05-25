package cqrs

import (
	"context"
	"time"

	"github.com/shaharsolomon/sdln/pkg/shared"
)

// Command represents a command in CQRS pattern
type Command interface {
	GetCommandID() string
	GetAggregateID() string
	GetUserID() string
	GetTenantID() string
	GetTimestamp() time.Time
	GetMetadata() map[string]interface{}
	Validate() error
}

// CommandHandler represents a command handler
type CommandHandler[T Command] interface {
	Handle(ctx context.Context, command T) error
	CanHandle(command Command) bool
}

// CommandBus represents command bus interface
type CommandBus interface {
	Dispatch(ctx context.Context, command Command) error
	Register(commandType string, handler CommandHandler[Command])
	RegisterHandler[T Command](handler CommandHandler[T])
}

// BaseCommand provides base implementation for commands
type BaseCommand struct {
	CommandID string                 `json:"command_id"`
	AggregateID string               `json:"aggregate_id"`
	UserID    string                 `json:"user_id"`
	TenantID  string                 `json:"tenant_id"`
	Timestamp time.Time              `json:"timestamp"`
	Metadata  map[string]interface{} `json:"metadata"`
}

// GetCommandID returns command ID
func (c *BaseCommand) GetCommandID() string {
	return c.CommandID
}

// GetAggregateID returns aggregate ID
func (c *BaseCommand) GetAggregateID() string {
	return c.AggregateID
}

// GetUserID returns user ID
func (c *BaseCommand) GetUserID() string {
	return c.UserID
}

// GetTenantID returns tenant ID
func (c *BaseCommand) GetTenantID() string {
	return c.TenantID
}

// GetTimestamp returns timestamp
func (c *BaseCommand) GetTimestamp() time.Time {
	return c.Timestamp
}

// GetMetadata returns metadata
func (c *BaseCommand) GetMetadata() map[string]interface{} {
	return c.Metadata
}

// User Commands

// RegisterUserCommand represents command to register a new user
type RegisterUserCommand struct {
	BaseCommand
	Email       string                 `json:"email"`
	Password    string                 `json:"password"`
	FirstName   string                 `json:"first_name"`
	LastName    string                 `json:"last_name"`
	Role        string                 `json:"role"`
	TenantID    string                 `json:"tenant_id"`
	Invitation  string                 `json:"invitation,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// Validate validates the register user command
func (c *RegisterUserCommand) Validate() error {
	if c.Email == "" {
		return ErrInvalidEmail
	}
	if c.Password == "" {
		return ErrInvalidPassword
	}
	if c.FirstName == "" {
		return ErrInvalidFirstName
	}
	if c.LastName == "" {
		return ErrInvalidLastName
	}
	if c.Role == "" {
		return ErrInvalidRole
	}
	if c.TenantID == "" {
		return ErrInvalidTenantID
	}
	return nil
}

// AuthenticateUserCommand represents command to authenticate user
type AuthenticateUserCommand struct {
	BaseCommand
	Email       string `json:"email"`
	Password    string `json:"password"`
	TenantID    string `json:"tenant_id,omitempty"`
	IPAddress   string `json:"ip_address"`
	UserAgent   string `json:"user_agent"`
	MFA         string `json:"mfa_code,omitempty"`
	RememberMe bool   `json:"remember_me"`
}

// Validate validates the authenticate user command
func (c *AuthenticateUserCommand) Validate() error {
	if c.Email == "" {
		return ErrInvalidEmail
	}
	if c.Password == "" {
		return ErrInvalidPassword
	}
	return nil
}

// UpdateUserProfileCommand represents command to update user profile
type UpdateUserProfileCommand struct {
	BaseCommand
	FirstName   string                 `json:"first_name"`
	LastName    string                 `json:"last_name"`
	AvatarURL   string                 `json:"avatar_url,omitempty"`
	Timezone    string                 `json:"timezone,omitempty"`
	Language    string                 `json:"language,omitempty"`
	Phone       string                 `json:"phone,omitempty"`
	Department  string                 `json:"department,omitempty"`
	Title       string                 `json:"title,omitempty"`
	Preferences map[string]interface{} `json:"preferences,omitempty"`
}

// Validate validates the update user profile command
func (c *UpdateUserProfileCommand) Validate() error {
	if c.FirstName == "" {
		return ErrInvalidFirstName
	}
	if c.LastName == "" {
		return ErrInvalidLastName
	}
	return nil
}

// DeactivateUserCommand represents command to deactivate user
type DeactivateUserCommand struct {
	BaseCommand
	Reason string `json:"reason,omitempty"`
}

// Validate validates the deactivate user command
func (c *DeactivateUserCommand) Validate() error {
	return nil
}

// Document Commands

// UploadDocumentCommand represents command to upload a document
type UploadDocumentCommand struct {
	BaseCommand
	FileName      string                 `json:"file_name"`
	FileSize      int64                  `json:"file_size"`
	ContentType   string                 `json:"content_type"`
	Checksum      string                 `json:"checksum"`
	Description   string                 `json:"description,omitempty"`
	Tags          []string               `json:"tags,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	AccessControl shared.AccessControl   `json:"access_control,omitempty"`
}

// Validate validates the upload document command
func (c *UploadDocumentCommand) Validate() error {
	if c.FileName == "" {
		return ErrInvalidFileName
	}
	if c.FileSize <= 0 {
		return ErrInvalidFileSize
	}
	if c.ContentType == "" {
		return ErrInvalidContentType
	}
	if c.Checksum == "" {
		return ErrInvalidChecksum
	}
	return nil
}

// ProcessDocumentCommand represents command to process a document
type ProcessDocumentCommand struct {
	BaseCommand
	DocumentID string `json:"document_id"`
	Options    ProcessOptions `json:"options"`
}

type ProcessOptions struct {
	GenerateVectors bool     `json:"generate_vectors"`
	ExtractText     bool     `json:"extract_text"`
	Language        string   `json:"language,omitempty"`
	Model           string   `json:"model,omitempty"`
	ChunkSize       int      `json:"chunk_size,omitempty"`
	ChunkOverlap    int      `json:"chunk_overlap,omitempty"`
	EnableOCR       bool     `json:"enable_ocr"`
	Tags            []string `json:"tags,omitempty"`
}

// Validate validates the process document command
func (c *ProcessDocumentCommand) Validate() error {
	if c.DocumentID == "" {
		return ErrInvalidDocumentID
	}
	return nil
}

// DeleteDocumentCommand represents command to delete a document
type DeleteDocumentCommand struct {
	BaseCommand
	DocumentID string `json:"document_id"`
	Permanent  bool   `json:"permanent"`
}

// Validate validates the delete document command
func (c *DeleteDocumentCommand) Validate() error {
	if c.DocumentID == "" {
		return ErrInvalidDocumentID
	}
	return nil
}

// RAG Commands

// SubmitQueryCommand represents command to submit a RAG query
type SubmitQueryCommand struct {
	BaseCommand
	Query        string                 `json:"query"`
	Context      []string               `json:"context,omitempty"`
	MaxResults   int                    `json:"max_results,omitempty"`
	Model        string                 `json:"model,omitempty"`
	Temperature  float64                `json:"temperature,omitempty"`
	MaxTokens    int                    `json:"max_tokens,omitempty"`
	Options      QueryOptions           `json:"options,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

type QueryOptions struct {
	IncludeCitations  bool     `json:"include_citations"`
	IncludeMetadata   bool     `json:"include_metadata"`
	FilterDocuments   []string `json:"filter_documents,omitempty"`
	FilterTags        []string `json:"filter_tags,omitempty"`
	SimilarityThreshold float64 `json:"similarity_threshold,omitempty"`
}

// Validate validates the submit query command
func (c *SubmitQueryCommand) Validate() error {
	if c.Query == "" {
		return ErrInvalidQuery
	}
	return nil
}

// Tenant Commands

// CreateTenantCommand represents command to create a new tenant
type CreateTenantCommand struct {
	BaseCommand
	Name        string                 `json:"name"`
	Plan        string                 `json:"plan"`
	OwnerEmail  string                 `json:"owner_email"`
	OwnerName   string                 `json:"owner_name"`
	Domain      string                 `json:"domain,omitempty"`
	Config      shared.TenantConfig    `json:"config,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// Validate validates the create tenant command
func (c *CreateTenantCommand) Validate() error {
	if c.Name == "" {
		return ErrInvalidTenantName
	}
	if c.Plan == "" {
		return ErrInvalidPlan
	}
	if c.OwnerEmail == "" {
		return ErrInvalidOwnerEmail
	}
	if c.OwnerName == "" {
		return ErrInvalidOwnerName
	}
	return nil
}

// UpdateTenantCommand represents command to update tenant
type UpdateTenantCommand struct {
	BaseCommand
	Name        string                 `json:"name,omitempty"`
	Plan        string                 `json:"plan,omitempty"`
	Status      string                 `json:"status,omitempty"`
	Config      *shared.TenantConfig   `json:"config,omitempty"`
	Settings    map[string]interface{} `json:"settings,omitempty"`
}

// Validate validates the update tenant command
func (c *UpdateTenantCommand) Validate() error {
	return nil
}

// SuspendTenantCommand represents command to suspend tenant
type SuspendTenantCommand struct {
	BaseCommand
	Reason string `json:"reason"`
}

// Validate validates the suspend tenant command
func (c *SuspendTenantCommand) Validate() error {
	if c.Reason == "" {
		return ErrInvalidReason
	}
	return nil
}

// Policy Commands

// CreatePolicyCommand represents command to create a new policy
type CreatePolicyCommand struct {
	BaseCommand
	Name        string                 `json:"name"`
	Type        string                 `json:"type"`
	Description string                 `json:"description,omitempty"`
	Rules       []shared.PolicyRule    `json:"rules"`
	Variables   map[string]interface{} `json:"variables,omitempty"`
	Enabled     bool                   `json:"enabled"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// Validate validates the create policy command
func (c *CreatePolicyCommand) Validate() error {
	if c.Name == "" {
		return ErrInvalidPolicyName
	}
	if c.Type == "" {
		return ErrInvalidPolicyType
	}
	if len(c.Rules) == 0 {
		return ErrInvalidPolicyRules
	}
	return nil
}

// UpdatePolicyCommand represents command to update policy
type UpdatePolicyCommand struct {
	BaseCommand
	Name        *string                `json:"name,omitempty"`
	Description *string                `json:"description,omitempty"`
	Rules       []shared.PolicyRule    `json:"rules,omitempty"`
	Variables   map[string]interface{} `json:"variables,omitempty"`
	Enabled     *bool                  `json:"enabled,omitempty"`
}

// Validate validates the update policy command
func (c *UpdatePolicyCommand) Validate() error {
	return nil
}

// DeletePolicyCommand represents command to delete policy
type DeletePolicyCommand struct {
	BaseCommand
}

// Validate validates the delete policy command
func (c *DeletePolicyCommand) Validate() error {
	return nil
}

// Payment Commands (PCI DSS Compliance)

// AddPaymentMethodCommand represents command to add payment method
type AddPaymentMethodCommand struct {
	BaseCommand
	Type         string                 `json:"type"`
	Token        string                 `json:"token"` // Tokenized payment method
	CardType     string                 `json:"card_type,omitempty"`
	LastFour     string                 `json:"last_four"`
	ExpiryMonth  string                 `json:"expiry_month,omitempty"`
	ExpiryYear   string                 `json:"expiry_year,omitempty"`
	CardBrand    string                 `json:"card_brand,omitempty"`
	BankName     string                 `json:"bank_name,omitempty"`
	Nickname     string                 `json:"nickname,omitempty"`
	Default      bool                   `json:"default"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// Validate validates the add payment method command
func (c *AddPaymentMethodCommand) Validate() error {
	if c.Type == "" {
		return ErrInvalidPaymentType
	}
	if c.Token == "" {
		return ErrInvalidPaymentToken
	}
	if c.LastFour == "" {
		return ErrInvalidLastFour
	}
	return nil
}

// ProcessPaymentCommand represents command to process payment
type ProcessPaymentCommand struct {
	BaseCommand
	Amount      int64                  `json:"amount"` // in cents
	Currency    string                 `json:"currency"`
	TokenID     string                 `json:"token_id"`
	Description string                 `json:"description,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// Validate validates the process payment command
func (c *ProcessPaymentCommand) Validate() error {
	if c.Amount <= 0 {
		return ErrInvalidAmount
	}
	if c.Currency == "" {
		return ErrInvalidCurrency
	}
	if c.TokenID == "" {
		return ErrInvalidTokenID
	}
	return nil
}

// RefundPaymentCommand represents command to refund payment
type RefundPaymentCommand struct {
	BaseCommand
	PaymentID   string `json:"payment_id"`
	Amount      int64  `json:"amount,omitempty"` // partial refund, nil for full
	Reason      string `json:"reason,omitempty"`
}

// Validate validates the refund payment command
func (c *RefundPaymentCommand) Validate() error {
	if c.PaymentID == "" {
		return ErrInvalidPaymentID
	}
	return nil
}

// Security Commands

// CreateSecurityIncidentCommand represents command to create security incident
type CreateSecurityIncidentCommand struct {
	BaseCommand
	Type        string                 `json:"type"`
	Severity    string                 `json:"severity"`
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	IPAddress   string                 `json:"ip_address,omitempty"`
	UserAgent   string                 `json:"user_agent,omitempty"`
	ResourceID  string                 `json:"resource_id,omitempty"`
	ResourceType string                `json:"resource_type,omitempty"`
	Details     map[string]interface{} `json:"details,omitempty"`
	Tags        []string               `json:"tags,omitempty"`
}

// Validate validates the create security incident command
func (c *CreateSecurityIncidentCommand) Validate() error {
	if c.Type == "" {
		return ErrInvalidIncidentType
	}
	if c.Severity == "" {
		return ErrInvalidSeverity
	}
	if c.Title == "" {
		return ErrInvalidTitle
	}
	if c.Description == "" {
		return ErrInvalidDescription
	}
	return nil
}

// ResolveSecurityIncidentCommand represents command to resolve security incident
type ResolveSecurityIncidentCommand struct {
	BaseCommand
	Resolution string                 `json:"resolution"`
	Actions    []string               `json:"actions_taken"`
	Details    map[string]interface{} `json:"details,omitempty"`
}

// Validate validates the resolve security incident command
func (c *ResolveSecurityIncidentCommand) Validate() error {
	if c.Resolution == "" {
		return ErrInvalidResolution
	}
	return nil
}

// Error definitions
var (
	// User errors
	ErrInvalidEmail        = NewCommandError("INVALID_EMAIL", "Invalid email address")
	ErrInvalidPassword     = NewCommandError("INVALID_PASSWORD", "Invalid password")
	ErrInvalidFirstName    = NewCommandError("INVALID_FIRST_NAME", "Invalid first name")
	ErrInvalidLastName     = NewCommandError("INVALID_LAST_NAME", "Invalid last name")
	ErrInvalidRole         = NewCommandError("INVALID_ROLE", "Invalid role")
	ErrInvalidTenantID     = NewCommandError("INVALID_TENANT_ID", "Invalid tenant ID")

	// Document errors
	ErrInvalidFileName     = NewCommandError("INVALID_FILE_NAME", "Invalid file name")
	ErrInvalidFileSize     = NewCommandError("INVALID_FILE_SIZE", "Invalid file size")
	ErrInvalidContentType  = NewCommandError("INVALID_CONTENT_TYPE", "Invalid content type")
	ErrInvalidChecksum     = NewCommandError("INVALID_CHECKSUM", "Invalid checksum")
	ErrInvalidDocumentID   = NewCommandError("INVALID_DOCUMENT_ID", "Invalid document ID")

	// RAG errors
	ErrInvalidQuery        = NewCommandError("INVALID_QUERY", "Invalid query")

	// Tenant errors
	ErrInvalidTenantName   = NewCommandError("INVALID_TENANT_NAME", "Invalid tenant name")
	ErrInvalidPlan         = NewCommandError("INVALID_PLAN", "Invalid plan")
	ErrInvalidOwnerEmail   = NewCommandError("INVALID_OWNER_EMAIL", "Invalid owner email")
	ErrInvalidOwnerName    = NewCommandError("INVALID_OWNER_NAME", "Invalid owner name")
	ErrInvalidReason       = NewCommandError("INVALID_REASON", "Invalid reason")

	// Policy errors
	ErrInvalidPolicyName   = NewCommandError("INVALID_POLICY_NAME", "Invalid policy name")
	ErrInvalidPolicyType   = NewCommandError("INVALID_POLICY_TYPE", "Invalid policy type")
	ErrInvalidPolicyRules  = NewCommandError("INVALID_POLICY_RULES", "Invalid policy rules")

	// Payment errors
	ErrInvalidPaymentType  = NewCommandError("INVALID_PAYMENT_TYPE", "Invalid payment type")
	ErrInvalidPaymentToken = NewCommandError("INVALID_PAYMENT_TOKEN", "Invalid payment token")
	ErrInvalidLastFour     = NewCommandError("INVALID_LAST_FOUR", "Invalid last four digits")
	ErrInvalidAmount       = NewCommandError("INVALID_AMOUNT", "Invalid amount")
	ErrInvalidCurrency     = NewCommandError("INVALID_CURRENCY", "Invalid currency")
	ErrInvalidTokenID      = NewCommandError("INVALID_TOKEN_ID", "Invalid token ID")
	ErrInvalidPaymentID    = NewCommandError("INVALID_PAYMENT_ID", "Invalid payment ID")

	// Security errors
	ErrInvalidIncidentType = NewCommandError("INVALID_INCIDENT_TYPE", "Invalid incident type")
	ErrInvalidSeverity     = NewCommandError("INVALID_SEVERITY", "Invalid severity")
	ErrInvalidTitle        = NewCommandError("INVALID_TITLE", "Invalid title")
	ErrInvalidDescription  = NewCommandError("INVALID_DESCRIPTION", "Invalid description")
	ErrInvalidResolution   = NewCommandError("INVALID_RESOLUTION", "Invalid resolution")
)

// CommandError represents a command validation error
type CommandError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Error implements error interface
func (e *CommandError) Error() string {
	return e.Message
}

// NewCommandError creates a new command error
func NewCommandError(code, message string) *CommandError {
	return &CommandError{
		Code:    code,
		Message: message,
	}
}
