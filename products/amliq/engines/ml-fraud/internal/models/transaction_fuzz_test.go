package models

import (
	"testing"
	"time"

	"github.com/shopspring/decimal"
)

// FuzzTransactionValidate feeds random data into TransactionData.Validate
// to verify it never panics on arbitrary input.
func FuzzTransactionValidate(f *testing.F) {
	// Seed corpus with representative and edge-case values.
	f.Add("txn-1", "100.00", "merch-1", "user-1", 45.0, -122.0, true)
	f.Add("", "0", "", "", 0.0, 0.0, false)
	f.Add("x", "-1.00", "m", "u", -91.0, 181.0, true)
	f.Add("txn-2", "99999999.99", "merch-2", "user-2", 90.0, -180.0, true)
	f.Add("' OR 1=1 --", "NaN", "'; DROP TABLE;", "admin'--", 0.0, 0.0, false)

	f.Fuzz(func(t *testing.T, txnID, amountStr, merchantID, userID string,
		lat, lon float64, hasLocation bool) {

		amount, err := decimal.NewFromString(amountStr)
		if err != nil {
			amount = decimal.NewFromFloat(0)
		}

		txn := &TransactionData{
			TransactionID: txnID,
			Amount:        amount,
			Timestamp:     time.Now(),
			MerchantID:    merchantID,
			UserID:        userID,
			PaymentMethod: "credit_card",
		}

		if hasLocation {
			txn.Location = &GeoLocation{
				Latitude:  lat,
				Longitude: lon,
			}
		}

		// Must not panic; errors are fine.
		_ = txn.Validate()
	})
}

// FuzzTransactionFeatures feeds random feature keys and values into
// GetFeatureValue/SetFeatureValue to confirm no panics.
func FuzzTransactionFeatures(f *testing.F) {
	f.Add("velocity", 1.5)
	f.Add("", 0.0)
	f.Add("key with spaces", -999.999)

	f.Fuzz(func(t *testing.T, key string, value float64) {
		txn := &TransactionData{}
		txn.SetFeatureValue(key, value)
		got, ok := txn.GetFeatureValue(key)
		if !ok {
			t.Fatal("expected feature to exist after SetFeatureValue")
		}
		if got != value {
			t.Fatalf("expected %v, got %v", value, got)
		}
	})
}
