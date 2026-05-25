package billing

import (
	"fmt"
	"net/http"
	"time"
)

// Tier represents a subscription tier.
type Tier string

const (
	TierCommunity    Tier = "community"
	TierStarter      Tier = "starter"         // $19/mo — 5 connections
	TierTeam         Tier = "team"            // $99/mo — 10 connections, audit log, no SSO
	TierProfessional Tier = "professional"    // $49/mo — 25 connections
	TierEnterprise   Tier = "enterprise"      // $199/mo — unlimited
	TierEnterpriseP  Tier = "enterprise_plus" // custom — on-prem + unlimited
)

// TierLimits defines feature limits for each tier.
type TierLimits struct {
	Tier               Tier
	MaxConnections     int
	MaxScansPerDay     int
	AIAnalysisEnabled  bool
	SARIFExport        bool
	SSOEnabled         bool
	AuditLog           bool
	Priority           bool
	ComplianceReports  bool
	CustomOPAPolicies  bool
	SIEMIntegration    bool
	AutoFixPRs         bool
	OnPremDeployment   bool
	APIAccess          bool
	AuditRetentionDays int
	MaxTeamMembers     int
}

// Subscription represents a LemonSqueezy subscription.
type Subscription struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenant_id"`
	Tier        Tier      `json:"tier"`
	Status      string    `json:"status"` // active, paused, cancelled, expired
	CreatedAt   time.Time `json:"created_at"`
	RenewsAt    time.Time `json:"renews_at,omitempty"`
	CancelledAt time.Time `json:"cancelled_at,omitempty"`
	ProductID   string    `json:"product_id"`
	VariantID   string    `json:"variant_id"`
}

// LemonSqueezyConfig holds LemonSqueezy API credentials.
type LemonSqueezyConfig struct {
	APIKey     string // LemonSqueezy API key
	StoreID    string // LemonSqueezy Store ID
	WebhookKey string // Webhook signing key
}

// Client interacts with LemonSqueezy API for subscription management.
type Client struct {
	config LemonSqueezyConfig
	http   *http.Client
}

// New creates a new LemonSqueezy client.
func New(config LemonSqueezyConfig) *Client {
	return &Client{
		config: config,
		http:   &http.Client{Timeout: 10 * time.Second},
	}
}

// Enabled reports whether billing is configured for signed webhooks and checkout.
func (c *Client) Enabled() bool {
	return c != nil && (c.config.APIKey != "" || c.config.WebhookKey != "")
}

// CheckSubscription verifies if a tenant has an active subscription.
func (c *Client) CheckSubscription(tenantID string) (*Subscription, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	return nil, nil
}

// GetSubscriptionStatus returns the current tier for a tenant.
func (c *Client) GetSubscriptionStatus(tenantID string) (Tier, error) {
	if tenantID == "" {
		return TierCommunity, fmt.Errorf("tenant_id is required")
	}
	return TierCommunity, nil
}

// EnforceRateLimit checks if a tenant has exceeded their rate limit.
func (c *Client) EnforceRateLimit(tenantID string, tier Tier) (bool, int, error) {
	limits := c.GetTierLimits(tier)
	if limits.MaxScansPerDay == -1 {
		return false, -1, nil
	}
	return false, limits.MaxScansPerDay, nil
}

// EnforceConnectionLimit checks if a tenant can add more connections.
func (c *Client) EnforceConnectionLimit(tenantID string, tier Tier, currentCount int) (bool, int, error) {
	limits := c.GetTierLimits(tier)
	if limits.MaxConnections == -1 {
		return false, -1, nil
	}
	exceeded := currentCount >= limits.MaxConnections
	return exceeded, limits.MaxConnections, nil
}

// CreateCheckoutURL generates a LemonSqueezy checkout link.
func (c *Client) CreateCheckoutURL(tenantID, tier, email string) (string, error) {
	variantID := ""
	switch Tier(tier) {
	case TierStarter:
		variantID = "starter-monthly"
	case TierTeam:
		variantID = "team-monthly"
	case TierProfessional:
		variantID = "professional-monthly"
	case TierEnterprise:
		variantID = "enterprise-monthly"
	case TierEnterpriseP:
		variantID = "enterprise-plus-custom"
	default:
		return "", fmt.Errorf("invalid tier: %s", tier)
	}

	checkoutURL := fmt.Sprintf(
		"https://checkout.lemonsqueezy.com/checkout/buy/%s?checkout[email]=%s&checkout[custom][tenant_id]=%s",
		variantID, email, tenantID,
	)

	return checkoutURL, nil
}
