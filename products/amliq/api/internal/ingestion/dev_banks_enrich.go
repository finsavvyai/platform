package ingestion

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

func setDevBankFields(ent *domain.Entity, rec []string, hdr headerIndex, listID string, typ domain.EntityType) {
	setMeta(ent, "dataset", listID)
	if typ == domain.EntityTypeIndividual {
		setMeta(ent, "schemaType", "Person")
	} else {
		setMeta(ent, "schemaType", "Organization")
	}

	if date := norm(hdr.get(rec, "Sanction Date", "sanction_date", "Date")); date != "" {
		setMeta(ent, "listing_date", date)
	}
	if end := norm(hdr.get(rec, "End Date", "end_date", "Expiry", "Expiry Date")); end != "" {
		setMeta(ent, "delisting_date", end)
	}

	addr := joinSemi(
		norm(hdr.get(rec, "Address", "address")),
		norm(hdr.get(rec, "City", "city")),
		norm(hdr.get(rec, "Country", "country")),
	)
	if addr != "" {
		ent.Addresses = append(ent.Addresses, addr)
	}

	// Promote country to first-class Nationalities so matchers + UI see it.
	if country := norm(hdr.get(rec, "Country", "country", "Nationality")); country != "" {
		addUnique(&ent.Nationalities, country)
	}

	if reason := norm(hdr.get(rec, "Reason", "reason", "Basis", "basis")); reason != "" {
		setMeta(ent, "remarks", reason)
	}

	url := "https://www.adb.org/integrity-and-compliance"
	if listID == "ebrd_ineligible" {
		url = "https://www.ebrd.com/integrity-and-compliance"
	}
	setMeta(ent, "source_url", url)
}
