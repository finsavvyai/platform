package rules

import "context"

// ListFilter controls filtering and pagination for rule listing.
type ListFilter struct {
	EnabledOnly  *bool
	DisabledOnly *bool
	Limit        int
	Offset       int
}

// RuleRepository defines the port for rule persistence.
// Implementations must enforce tenant isolation: every operation
// is scoped to a single tenantID and must never leak data across tenants.
type RuleRepository interface {
	// Create persists a new rule. Returns ErrDuplicateRuleID if the ID exists.
	Create(ctx context.Context, rule *Rule) error

	// Get returns a rule by ID scoped to the tenant.
	// Returns ErrRuleNotFound when the rule does not exist or belongs
	// to a different tenant.
	Get(ctx context.Context, tenantID, ruleID string) (*Rule, error)

	// List returns rules for the given tenant, respecting filter and pagination.
	List(ctx context.Context, tenantID string, filter ListFilter) ([]*Rule, error)

	// Update replaces the rule. Returns ErrRuleNotFound on miss or
	// tenant mismatch.
	Update(ctx context.Context, rule *Rule) error

	// Delete removes a rule by ID. Returns ErrRuleNotFound on miss or
	// tenant mismatch.
	Delete(ctx context.Context, tenantID, ruleID string) error

	// SetEnabled toggles the enabled flag. Returns ErrRuleNotFound on
	// miss or tenant mismatch.
	SetEnabled(ctx context.Context, tenantID, ruleID string, enabled bool) error
}
