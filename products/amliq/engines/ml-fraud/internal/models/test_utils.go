package models

import (
	"math/rand"
	"time"
)

// Test utility functions shared across model tests

// stringPtr creates a pointer to a string
func stringPtr(s string) *string {
	return &s
}

// timePtr creates a pointer to a time.Time
func timePtr(t time.Time) *time.Time {
	return &t
}

// floatPtr creates a pointer to a float64
func floatPtr(f float64) *float64 {
	return &f
}

// randomString generates a random string of specified length
func randomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[rand.Intn(len(charset))]
	}
	return string(b)
}

// randomPaymentMethod returns a random valid payment method
func randomPaymentMethod() string {
	methods := []string{"credit_card", "debit_card", "bank_transfer", "digital_wallet"}
	return methods[rand.Intn(len(methods))]
}

// randomUserRole returns a random valid user role
func randomUserRole() UserRole {
	roles := []UserRole{UserRoleAdmin, UserRoleDeveloper, UserRoleViewer, UserRoleEnterprise}
	return roles[rand.Intn(len(roles))]
}

// randomPricingTier returns a random valid pricing tier
func randomPricingTier() PricingTier {
	tiers := []PricingTier{PricingTierDeveloper, PricingTierGrowth, PricingTierScale, PricingTierEnterprise}
	return tiers[rand.Intn(len(tiers))]
}

// randomRiskLevel returns a random valid risk level
func randomRiskLevel() RiskLevel {
	levels := []RiskLevel{RiskLevelLow, RiskLevelMedium, RiskLevelHigh, RiskLevelCritical}
	return levels[rand.Intn(len(levels))]
}

// randomProcessingMethod returns a random valid processing method
func randomProcessingMethod() ProcessingMethod {
	methods := []ProcessingMethod{ProcessingMethodQuantum, ProcessingMethodClassical, ProcessingMethodHybrid}
	return methods[rand.Intn(len(methods))]
}
