package audit

import (
	"errors"
	"math"
	"regexp"
	"strings"
	"time"
)

// ThemeConfig stores a white-label theme scoped to a tenant.
type ThemeConfig struct {
	ID          string       `json:"id"`
	TenantID    string       `json:"tenant_id"`
	Name        string       `json:"name"`
	Colors      ColorPalette `json:"colors"`
	Typography  Typography   `json:"typography"`
	Brand       BrandAssets  `json:"brand"`
	IsActive    bool         `json:"is_active"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
}

// ColorPalette holds semantic colors for light and dark modes.
type ColorPalette struct {
	Primary       string `json:"primary"`
	Secondary     string `json:"secondary"`
	Accent        string `json:"accent"`
	Background    string `json:"background"`
	Surface       string `json:"surface"`
	TextPrimary   string `json:"text_primary"`
	TextSecondary string `json:"text_secondary"`
	Success       string `json:"success"`
	Warning       string `json:"warning"`
	Destructive   string `json:"destructive"`
	// Dark mode variants
	DarkBackground string `json:"dark_background"`
	DarkSurface    string `json:"dark_surface"`
	DarkText       string `json:"dark_text"`
}

// Typography holds font configuration.
type Typography struct {
	FontFamily    string  `json:"font_family"`
	HeadingWeight int     `json:"heading_weight"`
	BodyWeight    int     `json:"body_weight"`
	FontScale     float64 `json:"font_scale"`
}

// BrandAssets holds logo and naming configuration.
type BrandAssets struct {
	LogoURL    string `json:"logo_url"`
	LogoAlt    string `json:"logo_alt"`
	FaviconURL string `json:"favicon_url"`
	AppName    string `json:"app_name"`
}

// Validate checks all required fields and constraints.
func (t *ThemeConfig) Validate() error {
	if t.ID == "" {
		return ErrThemeEmptyID
	}
	if t.TenantID == "" {
		return ErrEmptyTenantID
	}
	if t.Name == "" {
		return ErrThemeEmptyName
	}
	if err := t.Colors.Validate(); err != nil {
		return err
	}
	if err := t.Typography.Validate(); err != nil {
		return err
	}
	return nil
}

var hexColorRe = regexp.MustCompile(`^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$`)

// Validate checks that all colors are valid hex codes.
func (c *ColorPalette) Validate() error {
	colors := map[string]string{
		"primary": c.Primary, "secondary": c.Secondary,
		"background": c.Background, "text_primary": c.TextPrimary,
	}
	for name, val := range colors {
		if val != "" && !hexColorRe.MatchString(val) {
			return &ThemeValidationError{Field: name, Msg: "must be a valid hex color"}
		}
	}
	return nil
}

// Validate checks typography constraints.
func (t *Typography) Validate() error {
	if t.FontScale < 0.8 || t.FontScale > 1.2 {
		if t.FontScale != 0 {
			return &ThemeValidationError{Field: "font_scale", Msg: "must be between 0.8 and 1.2"}
		}
	}
	if t.HeadingWeight != 0 && (t.HeadingWeight < 100 || t.HeadingWeight > 900) {
		return &ThemeValidationError{Field: "heading_weight", Msg: "must be 100-900"}
	}
	return nil
}

// ValidateContrast checks WCAG AA contrast ratio (4.5:1 for text).
func (c *ColorPalette) ValidateContrast() []ContrastResult {
	pairs := []struct{ name, fg, bg string }{
		{"text on background", c.TextPrimary, c.Background},
		{"text on surface", c.TextPrimary, c.Surface},
	}
	var results []ContrastResult
	for _, p := range pairs {
		if p.fg == "" || p.bg == "" {
			continue
		}
		ratio := ContrastRatio(p.fg, p.bg)
		results = append(results, ContrastResult{
			Pair:    p.name,
			Ratio:   ratio,
			Passes:  ratio >= 4.5,
		})
	}
	return results
}

// ContrastResult holds a WCAG contrast check result.
type ContrastResult struct {
	Pair   string  `json:"pair"`
	Ratio  float64 `json:"ratio"`
	Passes bool    `json:"passes"`
}

// ContrastRatio computes the WCAG 2.1 relative luminance contrast ratio.
func ContrastRatio(hex1, hex2 string) float64 {
	l1 := relativeLuminance(hex1)
	l2 := relativeLuminance(hex2)
	lighter := math.Max(l1, l2)
	darker := math.Min(l1, l2)
	return (lighter + 0.05) / (darker + 0.05)
}

func relativeLuminance(hex string) float64 {
	hex = strings.TrimPrefix(hex, "#")
	if len(hex) == 3 {
		hex = string([]byte{hex[0], hex[0], hex[1], hex[1], hex[2], hex[2]})
	}
	if len(hex) < 6 {
		return 0
	}
	r := linearize(hexToDec(hex[0:2]))
	g := linearize(hexToDec(hex[2:4]))
	b := linearize(hexToDec(hex[4:6]))
	return 0.2126*r + 0.7152*g + 0.0722*b
}

func hexToDec(s string) float64 {
	val := 0.0
	for _, c := range strings.ToLower(s) {
		val *= 16
		if c >= '0' && c <= '9' {
			val += float64(c - '0')
		} else if c >= 'a' && c <= 'f' {
			val += float64(c-'a') + 10
		}
	}
	return val / 255.0
}

func linearize(v float64) float64 {
	if v <= 0.04045 {
		return v / 12.92
	}
	return math.Pow((v+0.055)/1.055, 2.4)
}

// ThemeValidationError is a field-level validation error.
type ThemeValidationError struct {
	Field string
	Msg   string
}

func (e *ThemeValidationError) Error() string {
	return e.Field + ": " + e.Msg
}

// Sentinel errors for theme operations.
var (
	ErrThemeEmptyID     = errors.New("theme id must not be empty")
	ErrThemeEmptyName   = errors.New("theme name must not be empty")
	ErrThemeNotFound    = errors.New("theme not found")
	ErrThemeDeleteActive = errors.New("cannot delete the active theme")
)
