package audit

import (
	"context"
	"sync"
	"time"
)

// InMemoryThemeStore implements ThemeRepository using an in-memory map.
// Thread-safe via sync.RWMutex.
type InMemoryThemeStore struct {
	mu     sync.RWMutex
	themes map[string]*ThemeConfig // key: themeID
}

// NewInMemoryThemeStore creates an empty in-memory theme store.
func NewInMemoryThemeStore() *InMemoryThemeStore {
	return &InMemoryThemeStore{themes: make(map[string]*ThemeConfig)}
}

// Create stores a new theme.
func (s *InMemoryThemeStore) Create(_ context.Context, theme *ThemeConfig) error {
	if err := theme.Validate(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	theme.CreatedAt = time.Now()
	theme.UpdatedAt = theme.CreatedAt
	clone := *theme
	s.themes[theme.ID] = &clone
	return nil
}

// GetByID returns a theme by ID, scoped to tenant.
func (s *InMemoryThemeStore) GetByID(_ context.Context, tenantID, themeID string) (*ThemeConfig, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	theme, ok := s.themes[themeID]
	if !ok || theme.TenantID != tenantID {
		return nil, ErrThemeNotFound
	}
	clone := *theme
	return &clone, nil
}

// GetByTenant returns all themes for a tenant.
func (s *InMemoryThemeStore) GetByTenant(_ context.Context, tenantID string) ([]*ThemeConfig, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var results []*ThemeConfig
	for _, theme := range s.themes {
		if theme.TenantID == tenantID {
			clone := *theme
			results = append(results, &clone)
		}
	}
	return results, nil
}

// GetActive returns the active theme for a tenant, or a default.
func (s *InMemoryThemeStore) GetActive(_ context.Context, tenantID string) (*ThemeConfig, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, theme := range s.themes {
		if theme.TenantID == tenantID && theme.IsActive {
			clone := *theme
			return &clone, nil
		}
	}
	return defaultTheme(tenantID), nil
}

// Update modifies an existing theme.
func (s *InMemoryThemeStore) Update(_ context.Context, theme *ThemeConfig) error {
	if err := theme.Validate(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	existing, ok := s.themes[theme.ID]
	if !ok || existing.TenantID != theme.TenantID {
		return ErrThemeNotFound
	}
	theme.UpdatedAt = time.Now()
	theme.CreatedAt = existing.CreatedAt
	clone := *theme
	s.themes[theme.ID] = &clone
	return nil
}

// Delete removes a theme. Fails if the theme is currently active.
func (s *InMemoryThemeStore) Delete(_ context.Context, tenantID, themeID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	theme, ok := s.themes[themeID]
	if !ok || theme.TenantID != tenantID {
		return ErrThemeNotFound
	}
	if theme.IsActive {
		return ErrThemeDeleteActive
	}
	delete(s.themes, themeID)
	return nil
}

// SetActive activates a theme and deactivates all others for the tenant.
func (s *InMemoryThemeStore) SetActive(_ context.Context, tenantID, themeID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	target, ok := s.themes[themeID]
	if !ok || target.TenantID != tenantID {
		return ErrThemeNotFound
	}
	// Deactivate all others
	for _, theme := range s.themes {
		if theme.TenantID == tenantID {
			theme.IsActive = false
		}
	}
	target.IsActive = true
	target.UpdatedAt = time.Now()
	return nil
}

func defaultTheme(tenantID string) *ThemeConfig {
	return &ThemeConfig{
		ID:       "default",
		TenantID: tenantID,
		Name:     "Default",
		Colors: ColorPalette{
			Primary: "#0ea5e9", Secondary: "#334155",
			Background: "#ffffff", Surface: "#f8fafc",
			TextPrimary: "#0f172a", TextSecondary: "#64748b",
			DarkBackground: "#0f172a", DarkSurface: "#1e293b", DarkText: "#f8fafc",
		},
		Typography: Typography{
			FontFamily: "Inter", HeadingWeight: 700, BodyWeight: 400, FontScale: 1.0,
		},
		Brand:    BrandAssets{AppName: "FinTech Platform"},
		IsActive: true,
	}
}
