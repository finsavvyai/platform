package ingestion

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

func setWorldBankFields(ent *domain.Entity, rec []string, hdr headerIndex) {
	// Metadata — dataset & schema
	setMeta(ent, "dataset", "worldbank_debarred")
	setMeta(ent, "schemaType", "Organization")

	// Debarment date
	if debDate := norm(hdr.get(rec, "Debarment Date", "debarment_date", "Date")); debDate != "" {
		setMeta(ent, "listing_date", debDate)
	}

	// Address
	addr := joinSemi(
		norm(hdr.get(rec, "Address", "address")),
		norm(hdr.get(rec, "City", "city")),
	)
	if addr != "" {
		ent.Addresses = append(ent.Addresses, addr)
	}

	// Reason for debarment
	if reason := norm(hdr.get(rec, "Reason", "reason", "Basis", "basis")); reason != "" {
		setMeta(ent, "remarks", reason)
	}

	// Contact info if present
	if email := norm(hdr.get(rec, "Email", "email")); email != "" {
		setMeta(ent, "emails", email)
	}

	// Source URL
	setMeta(ent, "source_url", "https://www.worldbank.org/en/projects-operations/procurement/debarred-firms")
}
