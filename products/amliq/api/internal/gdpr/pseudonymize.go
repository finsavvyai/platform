package gdpr

import (
	"crypto/sha256"
	"encoding/hex"
	"time"
)

// CustomerRecord holds raw customer data for screening.
type CustomerRecord struct {
	CustomerID    string
	Name          string
	DOB           *time.Time
	Nationality   string
	EntityType    string
	Address       string
	Phone         string
	Email         string
	AccountNumber string
	SSN           string
}

// PseudonymizedRecord contains only what's needed for screening.
// PII fields (address, phone, email, account, SSN) are stripped.
type PseudonymizedRecord struct {
	RefHash    string     // SHA256(customer_id + salt)
	Name       string     // retained for screening
	DOB        *time.Time // retained for matching
	Nationality string
	EntityType string
}

// Pseudonymize strips PII and replaces the customer ID with a
// salted hash. The name is kept because screening requires it.
func Pseudonymize(record CustomerRecord, salt string) PseudonymizedRecord {
	return PseudonymizedRecord{
		RefHash:     hashWithSalt(record.CustomerID, salt),
		Name:        record.Name,
		DOB:         record.DOB,
		Nationality: record.Nationality,
		EntityType:  record.EntityType,
	}
}

// Deanonymize reverses the pseudonymization by recomputing the hash.
// Only the data controller (bank) possessing the salt can do this.
func Deanonymize(customerID, salt string) string {
	return hashWithSalt(customerID, salt)
}

// VerifyIdentity checks whether a customer ID matches a ref hash
// given the same salt used during pseudonymization.
func VerifyIdentity(customerID, refHash, salt string) bool {
	return hashWithSalt(customerID, salt) == refHash
}

func hashWithSalt(value, salt string) string {
	h := sha256.New()
	h.Write([]byte(value + salt))
	return hex.EncodeToString(h.Sum(nil))
}
