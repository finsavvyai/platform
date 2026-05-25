package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// enrichFTMCore populates DOB, gender, birth place, nationality,
// position, topics, and tier from the FTM properties map. This is
// the main coverage win vs targets.simple.csv — most of these
// fields are absent from the simple CSV projection.
func enrichFTMCore(ent *domain.Entity, props map[string][]string) {
	if dob := firstSliceStr(props["birthDate"]); dob != "" {
		setMeta(ent, "dob", dob)
		parseDOB(ent, dob)
	}
	if dod := firstSliceStr(props["deathDate"]); dod != "" {
		setMeta(ent, "death_date", dod)
	}
	gender := firstSliceStr(props["gender"])
	birthPlace := firstSliceStr(props["birthPlace"])
	position := firstSliceStr(props["position"])
	setMeta(ent, "gender", gender)
	setMeta(ent, "birth_place", birthPlace)
	setMeta(ent, "birth_country", firstSliceStr(props["birthCountry"]))
	setMeta(ent, "position", position)
	setMeta(ent, "summary", firstSliceStr(props["summary"]))
	setMeta(ent, "topics", joinSemi(props["topics"]...))
	if ent.Gender == "" {
		ent.Gender = gender
	}
	if ent.PlaceOfBirth == "" {
		ent.PlaceOfBirth = birthPlace
	}
	if ent.PositionTitle == "" {
		ent.PositionTitle = position
	}
	for _, c := range props["nationality"] {
		addUnique(&ent.Nationalities, strings.TrimSpace(c))
	}
	for _, c := range props["country"] {
		addUnique(&ent.Nationalities, strings.TrimSpace(c))
	}
	schema, _ := ent.Metadata["schemaType"].(string)
	if position != "" && ent.PEPTier == domain.PEPTierNone {
		ent.PEPTier = classifyPEPTier(position, schema)
	}
	setPepTier(ent, props["topics"])
}

// enrichFTMIdentity maps FTM identity properties into the domain
// Identifiers slice. Aliases, passports, national IDs, tax numbers,
// and inn/ogrn codes are all surfaced so exact-match screening can
// hit on any of them.
func enrichFTMIdentity(ent *domain.Entity, props map[string][]string) {
	for _, a := range props["alias"] {
		if a == "" {
			continue
		}
		name, err := domain.NewName(NormalizeName(a), "", "", "")
		if err == nil {
			ent.Names = append(ent.Names, name)
		}
	}
	appendIdent(ent, props["passportNumber"], domain.IDPassport, "")
	appendIdent(ent, props["idNumber"], domain.IDNationalID, "")
	appendIdent(ent, props["taxNumber"], domain.IDTaxID, "")
	appendIdent(ent, props["innCode"], domain.IDTaxID, "RU")
	appendIdent(ent, props["ogrnCode"], domain.IDRegistration, "RU")
	appendIdent(ent, props["leiCode"], domain.IDRegistration, "")
}

// enrichFTMContact populates addresses, emails, and phones meta.
func enrichFTMContact(ent *domain.Entity, props map[string][]string) {
	for _, a := range props["address"] {
		if s := strings.TrimSpace(a); s != "" {
			ent.Addresses = append(ent.Addresses, s)
		}
	}
	setMeta(ent, "emails", joinSemi(props["email"]...))
	setMeta(ent, "phones", joinSemi(props["phone"]...))
	setMeta(ent, "source_url", firstSliceStr(props["sourceUrl"]))
}

// appendIdent appends one Identifier per value onto the entity.
func appendIdent(
	ent *domain.Entity, vals []string, typ domain.IdentifierType, country string,
) {
	for _, v := range vals {
		if s := strings.TrimSpace(v); s != "" {
			id, err := domain.NewIdentifier(typ, s, country)
			if err == nil {
				ent.Identifiers = append(ent.Identifiers, id)
			}
		}
	}
}
