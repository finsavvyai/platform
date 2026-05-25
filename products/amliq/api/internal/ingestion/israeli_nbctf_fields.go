package ingestion

import (
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

func setNBCTFFields(ent *domain.Entity, rec []string) {
	aliases := buildNBCTFAliases(rec)
	setMeta(ent, "aliases", aliases)
	dobStr := nbctfField(rec, nbctfColDOB)
	setMeta(ent, "dob", dobStr)
	if dobStr != "" {
		parseDOB(ent, dobStr)
	}
	setMeta(ent, "program", nbctfField(rec, nbctfColOrgEng))
	setMeta(ent, "phones", joinSemi(
		nbctfField(rec, nbctfColPhone1),
		nbctfField(rec, nbctfColPhone2),
	))
	setMeta(ent, "emails", joinSemi(
		nbctfField(rec, nbctfColEmail1),
	))

	// Extract ID number as Identifier
	idNum := nbctfField(rec, nbctfColIDNum)
	if idNum != "" {
		id, _ := domain.NewIdentifier(domain.IDNationalID, idNum, "IL")
		ent.Identifiers = append(ent.Identifiers, id)
	}

	// Extract company registration number as Identifier
	compReg := nbctfField(rec, nbctfColCompanyReg)
	if compReg != "" {
		id, _ := domain.NewIdentifier(domain.IDRegistration, compReg, "IL")
		ent.Identifiers = append(ent.Identifiers, id)
	}

	addr := joinNonEmpty(
		nbctfField(rec, nbctfColStreet1),
		nbctfField(rec, nbctfColStreet2),
		nbctfField(rec, nbctfColBuilding),
		nbctfField(rec, nbctfColFloor),
		nbctfField(rec, nbctfColCity),
		nbctfField(rec, nbctfColPostal),
		nbctfField(rec, nbctfColCountry),
	)
	if addr != "" {
		ent.Addresses = append(ent.Addresses, addr)
	}
}

// buildNBCTFEntity builds an entity from HTML-parsed Hebrew/English names.
func buildNBCTFEntity(
	idx int, nameHeb, nameEng string,
) (domain.Entity, error) {
	idStr := fmt.Sprintf("ent_%012d", idx)
	id, err := domain.NewEntityID(idStr)
	if err != nil {
		return domain.Entity{}, err
	}
	primary, _ := domain.NewName(nameHeb, "", "", nameHeb)
	names := []domain.Name{primary}
	if nameEng != "" {
		if alias, err := domain.NewName(nameEng, "", "", ""); err == nil {
			names = append(names, alias)
		}
	}
	ent, err := domain.NewEntity(id, domain.EntityTypeIndividual, names)
	if err != nil {
		return domain.Entity{}, err
	}
	ent.ListID = "israeli_nbctf"
	ent.Nationalities = []string{"IL"}
	return ent, nil
}

func buildNBCTFAliases(rec []string) string {
	return joinSemi(
		nbctfField(rec, nbctfColAkaEng),
		nbctfField(rec, nbctfColNickEng),
		nbctfField(rec, nbctfColAkaHeb),
		nbctfField(rec, nbctfColNickHeb),
	)
}
