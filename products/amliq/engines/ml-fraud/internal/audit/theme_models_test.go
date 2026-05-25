package audit

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func validTheme() *ThemeConfig {
	return &ThemeConfig{
		ID:       "theme-001",
		TenantID: "tenant-001",
		Name:     "Corporate Blue",
		Colors: ColorPalette{
			Primary:        "#0ea5e9",
			Secondary:      "#334155",
			Background:     "#ffffff",
			Surface:        "#f8fafc",
			TextPrimary:    "#0f172a",
			TextSecondary:  "#64748b",
			DarkBackground: "#0f172a",
			DarkSurface:    "#1e293b",
			DarkText:       "#f8fafc",
		},
		Typography: Typography{
			FontFamily:    "Inter",
			HeadingWeight: 700,
			BodyWeight:    400,
			FontScale:     1.0,
		},
		Brand: BrandAssets{
			LogoURL:    "https://cdn.example.com/logo.svg",
			LogoAlt:    "FinTech Corp",
			FaviconURL: "https://cdn.example.com/favicon.ico",
			AppName:    "FinTech Dashboard",
		},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

func TestThemeConfig_Validate(t *testing.T) {
	t.Run("valid theme passes", func(t *testing.T) {
		theme := validTheme()
		require.NoError(t, theme.Validate())
	})

	t.Run("empty id fails", func(t *testing.T) {
		theme := validTheme()
		theme.ID = ""
		assert.ErrorIs(t, theme.Validate(), ErrThemeEmptyID)
	})

	t.Run("empty tenant id fails", func(t *testing.T) {
		theme := validTheme()
		theme.TenantID = ""
		assert.ErrorIs(t, theme.Validate(), ErrEmptyTenantID)
	})

	t.Run("empty name fails", func(t *testing.T) {
		theme := validTheme()
		theme.Name = ""
		assert.ErrorIs(t, theme.Validate(), ErrThemeEmptyName)
	})
}

func TestColorPalette_Validate(t *testing.T) {
	t.Run("valid hex colors pass", func(t *testing.T) {
		c := &ColorPalette{Primary: "#0ea5e9", Background: "#fff", TextPrimary: "#0f172a"}
		require.NoError(t, c.Validate())
	})

	t.Run("invalid hex fails", func(t *testing.T) {
		c := &ColorPalette{Primary: "not-a-color", Background: "#fff", TextPrimary: "#000"}
		err := c.Validate()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "primary")
	})

	t.Run("empty colors pass (optional)", func(t *testing.T) {
		c := &ColorPalette{}
		require.NoError(t, c.Validate())
	})

	t.Run("3-digit hex passes", func(t *testing.T) {
		c := &ColorPalette{Primary: "#abc"}
		require.NoError(t, c.Validate())
	})

	t.Run("8-digit hex with alpha passes", func(t *testing.T) {
		c := &ColorPalette{Primary: "#0ea5e9ff"}
		require.NoError(t, c.Validate())
	})
}

func TestTypography_Validate(t *testing.T) {
	t.Run("valid typography passes", func(t *testing.T) {
		ty := &Typography{FontScale: 1.0, HeadingWeight: 700}
		require.NoError(t, ty.Validate())
	})

	t.Run("font scale too low fails", func(t *testing.T) {
		ty := &Typography{FontScale: 0.5}
		err := ty.Validate()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "font_scale")
	})

	t.Run("font scale too high fails", func(t *testing.T) {
		ty := &Typography{FontScale: 1.5}
		err := ty.Validate()
		require.Error(t, err)
	})

	t.Run("zero font scale passes (default)", func(t *testing.T) {
		ty := &Typography{FontScale: 0}
		require.NoError(t, ty.Validate())
	})

	t.Run("invalid heading weight fails", func(t *testing.T) {
		ty := &Typography{HeadingWeight: 50, FontScale: 1.0}
		err := ty.Validate()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "heading_weight")
	})
}

func TestContrastRatio(t *testing.T) {
	t.Run("black on white passes WCAG AA", func(t *testing.T) {
		ratio := ContrastRatio("#000000", "#ffffff")
		assert.True(t, ratio >= 4.5, "contrast ratio should be >= 4.5, got %f", ratio)
		assert.InDelta(t, 21.0, ratio, 0.1)
	})

	t.Run("white on white fails", func(t *testing.T) {
		ratio := ContrastRatio("#ffffff", "#ffffff")
		assert.InDelta(t, 1.0, ratio, 0.01)
	})

	t.Run("similar colors have low contrast", func(t *testing.T) {
		ratio := ContrastRatio("#cccccc", "#dddddd")
		assert.True(t, ratio < 4.5)
	})
}

func TestColorPalette_ValidateContrast(t *testing.T) {
	t.Run("dark text on white background passes", func(t *testing.T) {
		c := &ColorPalette{
			TextPrimary: "#0f172a",
			Background:  "#ffffff",
			Surface:     "#f8fafc",
		}
		results := c.ValidateContrast()
		require.Len(t, results, 2)
		assert.True(t, results[0].Passes, "text on background should pass")
	})

	t.Run("light text on light background fails", func(t *testing.T) {
		c := &ColorPalette{
			TextPrimary: "#e0e0e0",
			Background:  "#ffffff",
			Surface:     "#f0f0f0",
		}
		results := c.ValidateContrast()
		for _, r := range results {
			assert.False(t, r.Passes, "%s should fail", r.Pair)
		}
	})
}
