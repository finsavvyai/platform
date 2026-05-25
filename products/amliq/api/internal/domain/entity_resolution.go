package domain

import (
	"strings"
	"time"
)

// EntityCluster groups potentially duplicate entities.
type EntityCluster struct {
	ClusterID  string
	TenantID   TenantID
	EntityIDs  []string
	MergedName string
	Confidence float64
	Status     string // pending, confirmed, rejected
	CreatedAt  time.Time
}

// SecondaryIdentifier stores additional entity identifiers.
type SecondaryIdentifier struct {
	EntityID string
	Type     IdentifierType
	Value    string
}

// IdentifierType categorizes secondary identifiers.
type IdentifierType string

const (
	IDPassport     IdentifierType = "passport"
	IDNationalID   IdentifierType = "national_id"
	IDTaxID        IdentifierType = "tax_id"
	IDRegistration IdentifierType = "registration"
	IDBirthDate    IdentifierType = "birth_date"
	IDAddress      IdentifierType = "address"
	IDIMOID        IdentifierType = "imo_number"
	IDMMSI         IdentifierType = "mmsi"
)

// NormalizeName prepares a name for deduplication comparison.
func NormalizeName(name string) string {
	name = strings.ToLower(strings.TrimSpace(name))
	name = strings.Join(strings.Fields(name), " ")
	replacer := strings.NewReplacer(
		".", "", ",", "", "-", " ", "'", "", "\"", "",
	)
	return replacer.Replace(name)
}

// SimpleDedupeScore returns similarity between two normalized names.
func SimpleDedupeScore(a, b string) float64 {
	na, nb := NormalizeName(a), NormalizeName(b)
	if na == nb {
		return 1.0
	}
	tokensA := strings.Fields(na)
	tokensB := strings.Fields(nb)
	matches := 0
	for _, ta := range tokensA {
		for _, tb := range tokensB {
			if ta == tb {
				matches++
				break
			}
		}
	}
	total := len(tokensA)
	if len(tokensB) > total {
		total = len(tokensB)
	}
	if total == 0 {
		return 0
	}
	return float64(matches) / float64(total)
}
