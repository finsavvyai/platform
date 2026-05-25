package security

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// CardValidator validates payment card information
type CardValidator struct {
	cardPatterns map[string]*CardPattern
}

// CardPattern represents card validation patterns
type CardPattern struct {
	Brand         string `json:"brand"`
	Type          string `json:"type"`
	Prefixes      []int  `json:"prefixes"`
	Lengths       []int  `json:"lengths"`
	CVVLength     int    `json:"cvv_length"`
	LuhnRequired  bool   `json:"luhn_required"`
	Regexp        string `json:"regexp"`
	CompiledRegex *regexp.Regexp
}

// NewCardValidator creates a new card validator
func NewCardValidator() *CardValidator {
	validator := &CardValidator{
		cardPatterns: make(map[string]*CardPattern),
	}

	// Initialize card patterns
	validator.initializeCardPatterns()
	return validator
}

// initializeCardPatterns sets up validation patterns for different card types
func (v *CardValidator) initializeCardPatterns() {
	patterns := []*CardPattern{
		{
			Brand:        "VISA",
			Type:         "CREDIT",
			Prefixes:     []int{4},
			Lengths:      []int{13, 16, 19},
			CVVLength:    3,
			LuhnRequired: true,
			Regexp:       `^4[0-9]{12}(?:[0-9]{3})?(?:[0-9]{3})?$`,
		},
		{
			Brand:        "MASTERCARD",
			Type:         "CREDIT",
			Prefixes:     []int{51, 52, 53, 54, 55, 2221, 2222, 2223, 2224, 2225, 2226, 2227, 2228, 2229, 223, 224, 225, 226, 227, 228, 229, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39},
			Lengths:      []int{16},
			CVVLength:    3,
			LuhnRequired: true,
			Regexp:       `^(5[1-5][0-9]{14}|2[2-7][0-9]{14})$`,
		},
		{
			Brand:        "AMEX",
			Type:         "CREDIT",
			Prefixes:     []int{34, 37},
			Lengths:      []int{15},
			CVVLength:    4,
			LuhnRequired: true,
			Regexp:       `^3[47][0-9]{13}$`,
		},
		{
			Brand:        "DISCOVER",
			Type:         "CREDIT",
			Prefixes:     []int{6011, 65, 644, 645, 646, 647, 648, 649},
			Lengths:      []int{16, 19},
			CVVLength:    3,
			LuhnRequired: true,
			Regexp:       `^(6011[0-9]{12}|65[0-9]{14}|6(?:011|5[0-9]{2})[0-9]{12})$`,
		},
		{
			Brand:        "JCB",
			Type:         "CREDIT",
			Prefixes:     []int{35},
			Lengths:      []int{16, 19},
			CVVLength:    3,
			LuhnRequired: true,
			Regexp:       `^(?:2131|1800|35[0-9]{3})[0-9]{11,14}$`,
		},
		{
			Brand:        "DINERS_CLUB",
			Type:         "CREDIT",
			Prefixes:     []int{300, 301, 302, 303, 304, 305, 36, 38, 39},
			Lengths:      []int{14, 16, 19},
			CVVLength:    3,
			LuhnRequired: true,
			Regexp:       `^(?:3[0689][0-9]{12}|(?:30[0-5]|36[0-9]|38[0-9])[0-9]{11})$`,
		},
		{
			Brand:        "UNIONPAY",
			Type:         "DEBIT",
			Prefixes:     []int{62},
			Lengths:      []int{16, 17, 18, 19},
			CVVLength:    3,
			LuhnRequired: false,
			Regexp:       `^(62[0-9]{14,17})$`,
		},
	}

	for _, pattern := range patterns {
		pattern.CompiledRegex = regexp.MustCompile(pattern.Regexp)
		v.cardPatterns[pattern.Brand] = pattern
	}
}

// ValidateCard validates complete card information
func (v *CardValidator) ValidateCard(card *PaymentCard) bool {
	if card == nil {
		return false
	}

	return v.ValidateCardNumber(card.Number) &&
		v.ValidateCVV(card.CVV) &&
		v.ValidateExpiry(card.ExpiryMonth, card.ExpiryYear)
}

// ValidateCardNumber validates card number using Luhn algorithm and card patterns
func (v *CardValidator) ValidateCardNumber(number string) bool {
	if number == "" {
		return false
	}

	// Remove spaces and dashes
	cleaned := v.cleanCardNumber(number)

	// Check if it's all digits
	for _, char := range cleaned {
		if char < '0' || char > '9' {
			return false
		}
	}

	// Check against known card patterns
	brand := v.GetCardBrand(cleaned)
	if brand == "" {
		return false
	}

	pattern := v.cardPatterns[brand]
	if pattern == nil {
		return false
	}

	// Check length
	validLength := false
	for _, length := range pattern.Lengths {
		if len(cleaned) == length {
			validLength = true
			break
		}
	}
	if !validLength {
		return false
	}

	// Check prefix
	validPrefix := false
	for _, prefix := range pattern.Prefixes {
		if v.hasPrefix(cleaned, prefix) {
			validPrefix = true
			break
		}
	}
	if !validPrefix {
		return false
	}

	// Check Luhn algorithm if required
	if pattern.LuhnRequired && !v.validateLuhn(cleaned) {
		return false
	}

	return true
}

// ValidateCVV validates CVV format
func (v *CardValidator) ValidateCVV(cvv string) bool {
	if cvv == "" {
		return false
	}

	// CVV should be 3 or 4 digits and all numeric
	if len(cvv) < 3 || len(cvv) > 4 {
		return false
	}

	for _, char := range cvv {
		if char < '0' || char > '9' {
			return false
		}
	}

	return true
}

// ValidateExpiry validates expiry date
func (v *CardValidator) ValidateExpiry(month, year string) bool {
	if month == "" || year == "" {
		return false
	}

	// Parse month
	monthInt, err := strconv.Atoi(month)
	if err != nil || monthInt < 1 || monthInt > 12 {
		return false
	}

	// Parse year
	yearInt, err := strconv.Atoi(year)
	if err != nil {
		return false
	}

	// Handle 2-digit years
	if yearInt < 100 {
		currentYear := time.Now().Year()
		yearInt += (currentYear / 100) * 100
		if yearInt < currentYear {
			yearInt += 100
		}
	}

	// Check if card is not expired
	expiry := time.Date(yearInt, time.Month(monthInt), 1, 0, 0, 0, 0, time.UTC)
	expiry = expiry.AddDate(0, 1, -1) // End of month

	return expiry.After(time.Now().UTC())
}

// GetCardBrand returns the card brand based on number
func (v *CardValidator) GetCardBrand(number string) string {
	cleaned := v.cleanCardNumber(number)

	for brand, pattern := range v.cardPatterns {
		if pattern.CompiledRegex.MatchString(cleaned) {
			return brand
		}
	}

	return ""
}

// GetCardType returns the card type (CREDIT/DEBIT)
func (v *CardValidator) GetCardType(number string) string {
	brand := v.GetCardBrand(number)
	if pattern, exists := v.cardPatterns[brand]; exists {
		return pattern.Type
	}
	return ""
}

// GetExpectedCVVLength returns expected CVV length for card brand
func (v *CardValidator) GetExpectedCVVLength(number string) int {
	brand := v.GetCardBrand(number)
	if pattern, exists := v.cardPatterns[brand]; exists {
		return pattern.CVVLength
	}
	return 3 // Default
}

// IsExpired checks if card is expired
func (v *CardValidator) IsExpired(month, year string) bool {
	return !v.ValidateExpiry(month, year)
}

// GetExpiryDate returns expiry date as time.Time
func (v *CardValidator) GetExpiryDate(month, year string) (time.Time, error) {
	monthInt, err := strconv.Atoi(month)
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid month: %s", month)
	}

	yearInt, err := strconv.Atoi(year)
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid year: %s", year)
	}

	// Handle 2-digit years
	if yearInt < 100 {
		currentYear := time.Now().Year()
		yearInt += (currentYear / 100) * 100
		if yearInt < currentYear {
			yearInt += 100
		}
	}

	// Return end of expiry month
	expiry := time.Date(yearInt, time.Month(monthInt), 1, 0, 0, 0, 0, time.UTC)
	expiry = expiry.AddDate(0, 1, -1)

	return expiry, nil
}

// Helper methods

// cleanCardNumber removes spaces and dashes from card number
func (v *CardValidator) cleanCardNumber(number string) string {
	return strings.ReplaceAll(strings.ReplaceAll(number, " ", ""), "-", "")
}

// hasPrefix checks if number starts with prefix
func (v *CardValidator) hasPrefix(number string, prefix int) bool {
	prefixStr := strconv.Itoa(prefix)
	return strings.HasPrefix(number, prefixStr)
}

// validateLuhn validates using Luhn algorithm
func (v *CardValidator) validateLuhn(number string) bool {
	sum := 0
	alternate := false

	for i := len(number) - 1; i >= 0; i-- {
		digit := int(number[i] - '0')

		if alternate {
			digit *= 2
			if digit > 9 {
				digit = (digit % 10) + 1
			}
		}

		sum += digit
		alternate = !alternate
	}

	return sum%10 == 0
}

// CardInfo represents card information extracted from number
type CardInfo struct {
	Brand             string     `json:"brand"`
	Type              string     `json:"type"`
	LastFour          string     `json:"last_four"`
	ExpectedCVVLength int        `json:"expected_cvv_length"`
	IsExpired         bool       `json:"is_expired"`
	ExpiryDate        *time.Time `json:"expiry_date,omitempty"`
	Valid             bool       `json:"valid"`
}

// GetCardInfo extracts comprehensive card information
func (v *CardValidator) GetCardInfo(card *PaymentCard) *CardInfo {
	info := &CardInfo{
		Brand: v.GetCardBrand(card.Number),
		Type:  v.GetCardType(card.Number),
		Valid: v.ValidateCard(card),
	}

	if len(card.Number) >= 4 {
		info.LastFour = card.Number[len(card.Number)-4:]
	}

	info.ExpectedCVVLength = v.GetExpectedCVVLength(card.Number)

	if card.ExpiryMonth != "" && card.ExpiryYear != "" {
		info.IsExpired = v.IsExpired(card.ExpiryMonth, card.ExpiryYear)
		if !info.IsExpired {
			if expiry, err := v.GetExpiryDate(card.ExpiryMonth, card.ExpiryYear); err == nil {
				info.ExpiryDate = &expiry
			}
		}
	}

	return info
}

// ValidateBulk validates multiple cards and returns results
func (v *CardValidator) ValidateBulk(cards []*PaymentCard) []*CardInfo {
	results := make([]*CardInfo, len(cards))
	for i, card := range cards {
		results[i] = v.GetCardInfo(card)
	}
	return results
}

// GetSupportedBrands returns list of supported card brands
func (v *CardValidator) GetSupportedBrands() []string {
	var brands []string
	for brand := range v.cardPatterns {
		brands = append(brands, brand)
	}
	return brands
}

// GetPatternByBrand returns card pattern for specific brand
func (v *CardValidator) GetPatternByBrand(brand string) *CardPattern {
	return v.cardPatterns[brand]
}

// MaskCardNumber masks card number showing only last 4 digits
func (v *CardValidator) MaskCardNumber(number string) string {
	cleaned := v.cleanCardNumber(number)
	if len(cleaned) < 4 {
		return "****"
	}

	lastFour := cleaned[len(cleaned)-4:]
	maskedLength := len(cleaned) - 4
	masked := strings.Repeat("*", maskedLength) + lastFour

	// Add spacing for readability if original had spaces
	if strings.Contains(number, " ") {
		// Add spaces every 4 characters
		var result string
		for i, char := range masked {
			if i > 0 && i%4 == 0 {
				result += " "
			}
			result += string(char)
		}
		return result
	}

	return masked
}
