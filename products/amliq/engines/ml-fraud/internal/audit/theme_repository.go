package audit

import "context"

// ThemeRepository defines the port for theme CRUD operations.
// All operations are tenant-scoped; implementations must enforce isolation.
type ThemeRepository interface {
	// Create stores a new theme configuration.
	Create(ctx context.Context, theme *ThemeConfig) error

	// GetByID returns a theme by its ID within a tenant.
	GetByID(ctx context.Context, tenantID, themeID string) (*ThemeConfig, error)

	// GetByTenant returns all themes for a tenant.
	GetByTenant(ctx context.Context, tenantID string) ([]*ThemeConfig, error)

	// GetActive returns the currently active theme for a tenant.
	// Returns a default theme if none is active.
	GetActive(ctx context.Context, tenantID string) (*ThemeConfig, error)

	// Update modifies an existing theme.
	Update(ctx context.Context, theme *ThemeConfig) error

	// Delete removes a theme. Returns ErrThemeDeleteActive if active.
	Delete(ctx context.Context, tenantID, themeID string) error

	// SetActive activates a theme and deactivates others for the tenant.
	SetActive(ctx context.Context, tenantID, themeID string) error
}
