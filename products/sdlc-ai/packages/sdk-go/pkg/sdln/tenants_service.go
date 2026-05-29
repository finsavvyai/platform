package sdln

import (
	"context"
	"fmt"
)

// TenantService handles tenant-related operations
type TenantService struct {
	*BaseService
}

// NewTenantService creates a new tenant service
func NewTenantService(client *Client) *TenantService {
	return &TenantService{
		BaseService: NewBaseService(client, "tenants", "api/v1/tenants"),
	}
}

// CreateTenantRequest represents a request to create a tenant
type CreateTenantRequest struct {
	Name         string            `json:"name"`
	Domain       string            `json:"domain,omitempty"`
	Settings     TenantSettings    `json:"settings"`
	Metadata     map[string]string `json:"metadata,omitempty"`
	ParentID     *string           `json:"parent_id,omitempty"`
	IsEnterprise bool              `json:"is_enterprise,omitempty"`
}

// UpdateTenantRequest represents a request to update a tenant
type UpdateTenantRequest struct {
	Name     *string           `json:"name,omitempty"`
	Domain   *string           `json:"domain,omitempty"`
	Settings *TenantSettings   `json:"settings,omitempty"`
	Metadata map[string]string `json:"metadata,omitempty"`
}

// TenantSettings represents tenant configuration
type TenantSettings struct {
	MaxUsers        int    `json:"max_users"`
	MaxDocuments    int    `json:"max_documents"`
	MaxStorage      int    `json:"max_storage"` // in MB
	AllowSSO        bool   `json:"allow_sso"`
	RequireMFA      bool   `json:"require_mfa"`
	DataRetention   int    `json:"data_retention"` // in days
	EnableAudit     bool   `json:"enable_audit"`
	EncryptionLevel string `json:"encryption_level"` // standard, high, maximum
}

// Tenant represents a tenant
type Tenant struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	Domain       string            `json:"domain"`
	Settings     TenantSettings    `json:"settings"`
	Metadata     map[string]string `json:"metadata"`
	ParentID     *string           `json:"parent_id,omitempty"`
	IsEnterprise bool              `json:"is_enterprise"`
	Status       string            `json:"status"` // active, suspended, deleted
	CreatedAt    Timestamp              `json:"created_at"`
	UpdatedAt    Timestamp              `json:"updated_at"`
}

// Create creates a new tenant
func (s *TenantService) Create(ctx context.Context, req *CreateTenantRequest) (*Tenant, error) {
	var tenant Tenant
	err := s.doPost(ctx, "", req, &tenant)
	if err != nil {
		return nil, fmt.Errorf("failed to create tenant: %w", err)
	}
	return &tenant, nil
}

// Get retrieves a tenant by ID
func (s *TenantService) Get(ctx context.Context, tenantID string) (*Tenant, error) {
	var tenant Tenant
	err := s.doGet(ctx, fmt.Sprintf("/%s", tenantID), &tenant)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant: %w", err)
	}
	return &tenant, nil
}

// GetByDomain retrieves a tenant by domain
func (s *TenantService) GetByDomain(ctx context.Context, domain string) (*Tenant, error) {
	var tenant Tenant
	err := s.doGet(ctx, fmt.Sprintf("/by-domain/%s", domain), &tenant)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant by domain: %w", err)
	}
	return &tenant, nil
}

// List retrieves a list of tenants
func (s *TenantService) List(ctx context.Context, opts *ListOptions) (*PaginatedResponse[Tenant], error) {
	path := ""
	if opts != nil {
		path = s.buildQuery(map[string]interface{}{
			"page":      opts.Page,
			"page_size": opts.PageSize,
			"sort_by":   opts.SortBy,
			"sort_desc": opts.SortDesc,
		})
	}

	var response PaginatedResponse[Tenant]
	err := s.doGet(ctx, path, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list tenants: %w", err)
	}
	return &response, nil
}

// Update updates a tenant
func (s *TenantService) Update(ctx context.Context, tenantID string, req *UpdateTenantRequest) (*Tenant, error) {
	var tenant Tenant
	err := s.doPatch(ctx, fmt.Sprintf("/%s", tenantID), req, &tenant)
	if err != nil {
		return nil, fmt.Errorf("failed to update tenant: %w", err)
	}
	return &tenant, nil
}

// Delete deletes a tenant
func (s *TenantService) Delete(ctx context.Context, tenantID string) error {
	err := s.doDelete(ctx, fmt.Sprintf("/%s", tenantID))
	if err != nil {
		return fmt.Errorf("failed to delete tenant: %w", err)
	}
	return nil
}

// GetHierarchy retrieves the tenant hierarchy
func (s *TenantService) GetHierarchy(ctx context.Context, tenantID string) (*TenantHierarchy, error) {
	var hierarchy TenantHierarchy
	err := s.doGet(ctx, fmt.Sprintf("/%s/hierarchy", tenantID), &hierarchy)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant hierarchy: %w", err)
	}
	return &hierarchy, nil
}

// GetChildren retrieves child tenants
func (s *TenantService) GetChildren(ctx context.Context, tenantID string, opts *ListOptions) (*PaginatedResponse[Tenant], error) {
	path := fmt.Sprintf("/%s/children", tenantID)
	if opts != nil {
		path += s.buildQuery(map[string]interface{}{
			"page":      opts.Page,
			"page_size": opts.PageSize,
			"sort_by":   opts.SortBy,
			"sort_desc": opts.SortDesc,
		})
	}

	var response PaginatedResponse[Tenant]
	err := s.doGet(ctx, path, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get child tenants: %w", err)
	}
	return &response, nil
}

// CreateChild creates a child tenant
func (s *TenantService) CreateChild(ctx context.Context, parentID string, req *CreateTenantRequest) (*Tenant, error) {
	var tenant Tenant
	err := s.doPost(ctx, fmt.Sprintf("/%s/children", parentID), req, &tenant)
	if err != nil {
		return nil, fmt.Errorf("failed to create child tenant: %w", err)
	}
	return &tenant, nil
}

// Suspend suspends a tenant
func (s *TenantService) Suspend(ctx context.Context, tenantID string, reason string) error {
	req := map[string]string{
		"reason": reason,
	}

	err := s.doPost(ctx, fmt.Sprintf("/%s/suspend", tenantID), req, nil)
	if err != nil {
		return fmt.Errorf("failed to suspend tenant: %w", err)
	}
	return nil
}

// Unsuspend unsuspends a tenant
func (s *TenantService) Unsuspend(ctx context.Context, tenantID string) error {
	err := s.doPost(ctx, fmt.Sprintf("/%s/unsuspend", tenantID), nil, nil)
	if err != nil {
		return fmt.Errorf("failed to unsuspend tenant: %w", err)
	}
	return nil
}

// GetUsage retrieves tenant usage statistics
func (s *TenantService) GetUsage(ctx context.Context, tenantID string) (*TenantUsage, error) {
	var usage TenantUsage
	err := s.doGet(ctx, fmt.Sprintf("/%s/usage", tenantID), &usage)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant usage: %w", err)
	}
	return &usage, nil
}

// GetSettings retrieves tenant settings
func (s *TenantService) GetSettings(ctx context.Context, tenantID string) (*TenantSettings, error) {
	var settings TenantSettings
	err := s.doGet(ctx, fmt.Sprintf("/%s/settings", tenantID), &settings)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant settings: %w", err)
	}
	return &settings, nil
}

// UpdateSettings updates tenant settings
func (s *TenantService) UpdateSettings(ctx context.Context, tenantID string, settings *TenantSettings) error {
	err := s.doPut(ctx, fmt.Sprintf("/%s/settings", tenantID), settings, nil)
	if err != nil {
		return fmt.Errorf("failed to update tenant settings: %w", err)
	}
	return nil
}

// TenantHierarchy represents a tenant hierarchy
type TenantHierarchy struct {
	Root      *Tenant            `json:"root"`
	Children  []*TenantHierarchy `json:"children"`
	Depth     int                `json:"depth"`
	NodeCount int                `json:"node_count"`
}

// TenantUsage represents tenant usage statistics
type TenantUsage struct {
	UserCount      int   `json:"user_count"`
	DocumentCount  int   `json:"document_count"`
	StorageUsed    int64 `json:"storage_used"`  // in bytes
	StorageLimit   int64 `json:"storage_limit"` // in bytes
	APICalls       int64 `json:"api_calls"`
	TokenUsage     int64 `json:"token_usage"`
	LastActivityAt Timestamp  `json:"last_activity_at"`
}
