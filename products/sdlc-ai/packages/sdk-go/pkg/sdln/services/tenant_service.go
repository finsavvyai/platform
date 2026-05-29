package services

import (
	"context"
	"fmt"
	"time"

	"github.com/SDLC/sdln-sdk-go/pkg/sdln"
)

// TenantService provides access to tenant management APIs
type TenantService struct {
	*sdln.BaseService
}

// NewTenantService creates a new TenantService
func NewTenantService(client *sdln.Client) *TenantService {
	return &TenantService{
		BaseService: sdln.NewBaseService(client, "tenants", "v1/tenants"),
	}
}

// Create creates a new tenant
func (s *TenantService) Create(ctx context.Context, tenant *sdln.Tenant) (*sdln.Tenant, error) {
	var result sdln.Tenant
	err := s.doPost(ctx, "", tenant, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to create tenant: %w", err)
	}
	return &result, nil
}

// Get retrieves a tenant by ID
func (s *TenantService) Get(ctx context.Context, tenantID sdln.ID) (*sdln.Tenant, error) {
	path := fmt.Sprintf("/%s", tenantID.String())
	var result sdln.Tenant
	err := s.doGet(ctx, path, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant: %w", err)
	}
	return &result, nil
}

// Update updates a tenant
func (s *TenantService) Update(ctx context.Context, tenantID sdln.ID, tenant *sdln.Tenant) (*sdln.Tenant, error) {
	path := fmt.Sprintf("/%s", tenantID.String())
	var result sdln.Tenant
	err := s.doPut(ctx, path, tenant, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to update tenant: %w", err)
	}
	return &result, nil
}

// Delete deletes a tenant
func (s *TenantService) Delete(ctx context.Context, tenantID sdln.ID) error {
	path := fmt.Sprintf("/%s", tenantID.String())
	err := s.doDelete(ctx, path)
	if err != nil {
		return fmt.Errorf("failed to delete tenant: %w", err)
	}
	return nil
}

// List retrieves a list of tenants with pagination and filtering
func (s *TenantService) List(ctx context.Context, opts *sdln.ListOptions) (*sdln.PaginatedResponse[sdln.Tenant], error) {
	query := s.buildQuery(opts)
	path := fmt.Sprintf("/%s", query)

	var result sdln.PaginatedResponse[sdln.Tenant]
	err := s.doGet(ctx, path, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to list tenants: %w", err)
	}
	return &result, nil
}

// GetUsers retrieves all users in a tenant
func (s *TenantService) GetUsers(ctx context.Context, tenantID sdln.ID, opts *sdln.ListOptions) (*sdln.PaginatedResponse[sdln.User], error) {
	path := fmt.Sprintf("/%s/users", tenantID.String())
	if opts != nil {
		path += s.buildQuery(map[string]interface{}{
			"page":      opts.Page,
			"page_size": opts.PageSize,
			"sort_by":   opts.SortBy,
			"sort_desc": opts.SortDesc,
		})
	}

	var result sdln.PaginatedResponse[sdln.User]
	err := s.doGet(ctx, path, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant users: %w", err)
	}
	return &result, nil
}

// AddUser adds a user to a tenant
func (s *TenantService) AddUser(ctx context.Context, tenantID sdln.ID, userID sdln.ID, role string) error {
	path := fmt.Sprintf("/%s/users", tenantID.String())
	req := map[string]interface{}{
		"user_id": userID.String(),
		"role":    role,
	}
	err := s.doPost(ctx, path, req, nil)
	if err != nil {
		return fmt.Errorf("failed to add user to tenant: %w", err)
	}
	return nil
}

// RemoveUser removes a user from a tenant
func (s *TenantService) RemoveUser(ctx context.Context, tenantID sdln.ID, userID sdln.ID) error {
	path := fmt.Sprintf("/%s/users/%s", tenantID.String(), userID.String())
	err := s.doDelete(ctx, path)
	if err != nil {
		return fmt.Errorf("failed to remove user from tenant: %w", err)
	}
	return nil
}

// UpdateUserRole updates a user's role in a tenant
func (s *TenantService) UpdateUserRole(ctx context.Context, tenantID sdln.ID, userID sdln.ID, role string) error {
	path := fmt.Sprintf("/%s/users/%s/role", tenantID.String(), userID.String())
	req := map[string]interface{}{
		"role": role,
	}
	err := s.doPut(ctx, path, req, nil)
	if err != nil {
		return fmt.Errorf("failed to update user role: %w", err)
	}
	return nil
}

// GetSettings retrieves tenant settings
func (s *TenantService) GetSettings(ctx context.Context, tenantID sdln.ID) (*sdln.TenantSettings, error) {
	path := fmt.Sprintf("/%s/settings", tenantID.String())
	var result sdln.TenantSettings
	err := s.doGet(ctx, path, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant settings: %w", err)
	}
	return &result, nil
}

// UpdateSettings updates tenant settings
func (s *TenantService) UpdateSettings(ctx context.Context, tenantID sdln.ID, settings *sdln.TenantSettings) error {
	path := fmt.Sprintf("/%s/settings", tenantID.String())
	err := s.doPut(ctx, path, settings, nil)
	if err != nil {
		return fmt.Errorf("failed to update tenant settings: %w", err)
	}
	return nil
}

// GetUsage retrieves tenant usage statistics
func (s *TenantService) GetUsage(ctx context.Context, tenantID sdln.ID, period string) (*sdln.UsageStats, error) {
	path := fmt.Sprintf("/%s/usage", tenantID.String())
	if period != "" {
		path += fmt.Sprintf("?period=%s", period)
	}

	var result sdln.UsageStats
	err := s.doGet(ctx, path, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant usage: %w", err)
	}
	return &result, nil
}

// GetInvoices retrieves tenant invoices
func (s *TenantService) GetInvoices(ctx context.Context, tenantID sdln.ID, opts *sdln.ListOptions) (*sdln.PaginatedResponse[sdln.Invoice], error) {
	path := fmt.Sprintf("/%s/invoices", tenantID.String())
	if opts != nil {
		path += s.buildQuery(map[string]interface{}{
			"page":      opts.Page,
			"page_size": opts.PageSize,
			"sort_by":   opts.SortBy,
			"sort_desc": opts.SortDesc,
		})
	}

	var result sdln.PaginatedResponse[sdln.Invoice]
	err := s.doGet(ctx, path, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant invoices: %w", err)
	}
	return &result, nil
}

// GetSubscription retrieves tenant subscription information
func (s *TenantService) GetSubscription(ctx context.Context, tenantID sdln.ID) (*sdln.Subscription, error) {
	path := fmt.Sprintf("/%s/subscription", tenantID.String())
	var result sdln.Subscription
	err := s.doGet(ctx, path, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant subscription: %w", err)
	}
	return &result, nil
}

// UpdateSubscription updates tenant subscription
func (s *TenantService) UpdateSubscription(ctx context.Context, tenantID sdln.ID, subscription *sdln.Subscription) error {
	path := fmt.Sprintf("/%s/subscription", tenantID.String())
	err := s.doPut(ctx, path, subscription, nil)
	if err != nil {
		return fmt.Errorf("failed to update tenant subscription: %w", err)
	}
	return nil
}

// GetAuditLogs retrieves tenant audit logs
func (s *TenantService) GetAuditLogs(ctx context.Context, tenantID sdln.ID, opts *sdln.AuditLogOptions) (*sdln.PaginatedResponse[sdln.AuditLog], error) {
	path := fmt.Sprintf("/%s/audit-logs", tenantID.String())
	queryParams := make(map[string]interface{})

	if opts != nil {
		if opts.StartTime != nil {
			queryParams["start_time"] = opts.StartTime.Format(time.RFC3339)
		}
		if opts.EndTime != nil {
			queryParams["end_time"] = opts.EndTime.Format(time.RFC3339)
		}
		if opts.Action != "" {
			queryParams["action"] = opts.Action
		}
		if opts.UserID != "" {
			queryParams["user_id"] = opts.UserID
		}
		queryParams["page"] = opts.Page
		queryParams["page_size"] = opts.PageSize
	}

	path += s.buildQuery(queryParams)

	var result sdln.PaginatedResponse[sdln.AuditLog]
	err := s.doGet(ctx, path, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant audit logs: %w", err)
	}
	return &result, nil
}

// GetMetrics retrieves tenant metrics
func (s *TenantService) GetMetrics(ctx context.Context, tenantID sdln.ID, metricNames []string, timeRange string) (*sdln.MetricsResponse, error) {
	path := fmt.Sprintf("/%s/metrics", tenantID.String())
	queryParams := map[string]interface{}{
		"metrics": metricNames,
		"range":   timeRange,
	}

	path += s.buildQuery(queryParams)

	var result sdln.MetricsResponse
	err := s.doGet(ctx, path, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant metrics: %w", err)
	}
	return &result, nil
}

// Suspend suspends a tenant
func (s *TenantService) Suspend(ctx context.Context, tenantID sdln.ID, reason string) error {
	path := fmt.Sprintf("/%s/suspend", tenantID.String())
	req := map[string]interface{}{
		"reason": reason,
	}
	err := s.doPost(ctx, path, req, nil)
	if err != nil {
		return fmt.Errorf("failed to suspend tenant: %w", err)
	}
	return nil
}

// Unsuspend unsuspends a tenant
func (s *TenantService) Unsuspend(ctx context.Context, tenantID sdln.ID) error {
	path := fmt.Sprintf("/%s/unsuspend", tenantID.String())
	err := s.doPost(ctx, path, nil, nil)
	if err != nil {
		return fmt.Errorf("failed to unsuspend tenant: %w", err)
	}
	return nil
}

// GetPolicies retrieves tenant policies
func (s *TenantService) GetPolicies(ctx context.Context, tenantID sdln.ID) ([]sdln.Policy, error) {
	path := fmt.Sprintf("/%s/policies", tenantID.String())
	var result struct {
		Policies []sdln.Policy `json:"policies"`
	}
	err := s.doGet(ctx, path, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant policies: %w", err)
	}
	return result.Policies, nil
}

// UpdatePolicies updates tenant policies
func (s *TenantService) UpdatePolicies(ctx context.Context, tenantID sdln.ID, policies []sdln.Policy) error {
	path := fmt.Sprintf("/%s/policies", tenantID.String())
	req := map[string]interface{}{
		"policies": policies,
	}
	err := s.doPut(ctx, path, req, nil)
	if err != nil {
		return fmt.Errorf("failed to update tenant policies: %w", err)
	}
	return nil
}

// GetAPIKeys retrieves tenant API keys
func (s *TenantService) GetAPIKeys(ctx context.Context, tenantID sdln.ID) ([]sdln.APIKey, error) {
	path := fmt.Sprintf("/%s/api-keys", tenantID.String())
	var result struct {
		APIKeys []sdln.APIKey `json:"api_keys"`
	}
	err := s.doGet(ctx, path, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant API keys: %w", err)
	}
	return result.APIKeys, nil
}

// CreateAPIKey creates a new API key for the tenant
func (s *TenantService) CreateAPIKey(ctx context.Context, tenantID sdln.ID, keyReq *sdln.CreateAPIKeyRequest) (*sdln.APIKey, error) {
	path := fmt.Sprintf("/%s/api-keys", tenantID.String())
	var result sdln.APIKey
	err := s.doPost(ctx, path, keyReq, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to create API key: %w", err)
	}
	return &result, nil
}

// RevokeAPIKey revokes a tenant API key
func (s *TenantService) RevokeAPIKey(ctx context.Context, tenantID sdln.ID, keyID string) error {
	path := fmt.Sprintf("/%s/api-keys/%s", tenantID.String(), keyID)
	err := s.doDelete(ctx, path)
	if err != nil {
		return fmt.Errorf("failed to revoke API key: %w", err)
	}
	return nil
}

// GetWebhooks retrieves tenant webhooks
func (s *TenantService) GetWebhooks(ctx context.Context, tenantID sdln.ID) ([]sdln.Webhook, error) {
	path := fmt.Sprintf("/%s/webhooks", tenantID.String())
	var result struct {
		Webhooks []sdln.Webhook `json:"webhooks"`
	}
	err := s.doGet(ctx, path, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant webhooks: %w", err)
	}
	return result.Webhooks, nil
}

// CreateWebhook creates a new webhook for the tenant
func (s *TenantService) CreateWebhook(ctx context.Context, tenantID sdln.ID, webhook *sdln.Webhook) (*sdln.Webhook, error) {
	path := fmt.Sprintf("/%s/webhooks", tenantID.String())
	var result sdln.Webhook
	err := s.doPost(ctx, path, webhook, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to create webhook: %w", err)
	}
	return &result, nil
}

// UpdateWebhook updates a tenant webhook
func (s *TenantService) UpdateWebhook(ctx context.Context, tenantID sdln.ID, webhookID string, webhook *sdln.Webhook) error {
	path := fmt.Sprintf("/%s/webhooks/%s", tenantID.String(), webhookID)
	err := s.doPut(ctx, path, webhook, nil)
	if err != nil {
		return fmt.Errorf("failed to update webhook: %w", err)
	}
	return nil
}

// DeleteWebhook deletes a tenant webhook
func (s *TenantService) DeleteWebhook(ctx context.Context, tenantID sdln.ID, webhookID string) error {
	path := fmt.Sprintf("/%s/webhooks/%s", tenantID.String(), webhookID)
	err := s.doDelete(ctx, path)
	if err != nil {
		return fmt.Errorf("failed to delete webhook: %w", err)
	}
	return nil
}

// TestWebhook tests a webhook endpoint
func (s *TenantService) TestWebhook(ctx context.Context, tenantID sdln.ID, webhookID string) (*sdln.WebhookTestResult, error) {
	path := fmt.Sprintf("/%s/webhooks/%s/test", tenantID.String(), webhookID)
	var result sdln.WebhookTestResult
	err := s.doPost(ctx, path, nil, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to test webhook: %w", err)
	}
	return &result, nil
}
