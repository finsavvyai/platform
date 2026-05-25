package ingestion

import (

	"github.com/aegis-aml/aegis/internal/domain"
)

func setUKHMTFields(ent *domain.Entity, rec []string, hdr headerIndex) {
	// Metadata — dataset & schema
	setMeta(ent, "dataset", "uk_hmt")
	if ent.Type == domain.EntityTypeIndividual {
		setMeta(ent, "schemaType", "Person")
	} else {
		setMeta(ent, "schemaType", "Organization")
	}

	// Aliases from alternative names
	aliases := joinSemi(
		norm(hdr.get(rec, "AKA", "aka", "Alias")),
		norm(hdr.get(rec, "Alias", "alias")),
		norm(hdr.get(rec, "Name", "name")),
	)
	if aliases != "" {
		setMeta(ent, "aliases", aliases)
	}

	// Date of birth (for individuals)
	if dob := norm(hdr.get(rec, "DOB", "Date of Birth", "date_of_birth")); dob != "" {
		setMeta(ent, "dob", dob)
		parseDOB(ent, dob)
	}

	// Listing / designation date
	if listDate := norm(hdr.get(rec, "Listing Date", "listing_date", "Designated", "designated")); listDate != "" {
		setMeta(ent, "listing_date", listDate)
	}

	// Address
	addr := joinSemi(
		norm(hdr.get(rec, "Address", "address", "Address 1")),
		norm(hdr.get(rec, "Address 2", "address2")),
		norm(hdr.get(rec, "Address 3", "address3")),
	)
	if addr != "" {
		ent.Addresses = append(ent.Addresses, addr)
	}

	// Phones and emails (if present)
	if phone := norm(hdr.get(rec, "Phone", "phone")); phone != "" {
		setMeta(ent, "phones", phone)
	}
	if email := norm(hdr.get(rec, "Email", "email")); email != "" {
		setMeta(ent, "emails", email)
	}

	// Remarks / target description
	if remarks := norm(hdr.get(rec, "Remarks", "remarks", "Description", "description")); remarks != "" {
		setMeta(ent, "remarks", remarks)
	}

	// Source URL
	setMeta(ent, "source_url", "https://www.gov.uk/government/publications/financial-sanctions-consolidated-list-of-targets")

	// Programs / sanctions list category
	if program := norm(hdr.get(rec, "Program", "program", "List", "list")); program != "" {
		setMeta(ent, "programs", program)
	}
}
