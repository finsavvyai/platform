package ingestion

import (
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// NBCTF CSV column indices.
const (
	nbctfColNumber     = 0
	nbctfColNameHeb    = 6
	nbctfColNameEng    = 7
	nbctfColAkaHeb     = 9
	nbctfColNickHeb    = 10
	nbctfColAkaEng     = 11
	nbctfColNickEng    = 12
	nbctfColIDNum      = 13
	nbctfColCompanyReg = 14
	nbctfColDOB        = 15
	nbctfColStreet1    = 17
	nbctfColStreet2    = 19
	nbctfColBuilding   = 20
	nbctfColFloor      = 21
	nbctfColCity       = 23
	nbctfColCountry    = 25
	nbctfColPostal     = 26
	nbctfColPhone1     = 27
	nbctfColPhone2     = 28
	nbctfColEmail1     = 29
	nbctfColOrgEng     = 33
)

func parseNBCTFRecord(rec []string) (domain.Entity, bool) {
	nameEng := nbctfField(rec, nbctfColNameEng)
	nameHeb := nbctfField(rec, nbctfColNameHeb)
	if isNBCTFHeader(nameEng, nameHeb) || (nameEng == "" && nameHeb == "") {
		return domain.Entity{}, false
	}

	primary := nameEng
	if primary == "" {
		primary = nameHeb
	}
	normalized := NormalizeName(primary)
	if normalized == "" {
		return domain.Entity{}, false
	}

	rawID := nbctfField(rec, nbctfColNumber)
	if rawID == "" {
		return domain.Entity{}, false
	}
	padded := fmt.Sprintf("%012s", rawID)
	padded = strings.ReplaceAll(padded, " ", "0")
	id, err := domain.NewEntityID("ent_" + padded)
	if err != nil {
		return domain.Entity{}, false
	}

	companyReg := nbctfField(rec, nbctfColCompanyReg)
	typ := domain.EntityTypeIndividual
	if companyReg != "" {
		typ = domain.EntityTypeCompany
	}

	name, _ := domain.NewName(normalized, "", "", "")
	ent, err := domain.NewEntity(id, typ, []domain.Name{name})
	if err != nil {
		return domain.Entity{}, false
	}
	ent.ListID = "israeli_nbctf"
	ent.Nationalities = []string{"IL"}

	setNBCTFFields(&ent, rec)
	return ent, true
}

func nbctfField(rec []string, idx int) string {
	if idx >= len(rec) {
		return ""
	}
	v := strings.TrimSpace(rec[idx])
	if v == "-" || v == "\u2014" {
		return ""
	}
	return v
}

func isNBCTFHeader(eng, heb string) bool {
	return eng == "Full name - English" || heb == "Full Name - Hebrew"
}
