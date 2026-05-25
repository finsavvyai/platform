package screening

import "github.com/aegis-aml/aegis/internal/domain"

var pepClassifyTestCases = []struct {
	name              string
	screeningCountry  string
	profile           domain.PEPProfile
	expectedClassType domain.PEPClassification
}{
	{
		name:             "RCA with relations",
		screeningCountry: "US",
		profile: domain.PEPProfile{
			EntityID: "rca-001", Country: "US", Position: "Business Associate",
			Relations: []domain.RCARelation{{PEPEntityID: "pep-001"}},
			IsActive:  true,
		},
		expectedClassType: domain.PEPRCA,
	},
	{
		name:             "Domestic PEP",
		screeningCountry: "US",
		profile: domain.PEPProfile{
			EntityID: "pep-001", Country: "US", Position: "President",
			Relations: []domain.RCARelation{}, IsActive: true,
		},
		expectedClassType: domain.PEPDomestic,
	},
	{
		name:             "Domestic PEP lowercase country",
		screeningCountry: "US",
		profile: domain.PEPProfile{
			EntityID: "pep-002", Country: "us", Position: "Minister",
			Relations: []domain.RCARelation{}, IsActive: true,
		},
		expectedClassType: domain.PEPDomestic,
	},
	{
		name:             "International Org PEP",
		screeningCountry: "US",
		profile: domain.PEPProfile{
			EntityID: "pep-003", Country: "CH",
			Position: "Director of UN Development Program",
			Relations: []domain.RCARelation{}, IsActive: true,
		},
		expectedClassType: domain.PEPInternationalOrg,
	},
	{
		name:             "International Org EU keyword",
		screeningCountry: "GB",
		profile: domain.PEPProfile{
			EntityID: "pep-004", Country: "FR", Position: "EU Commission Official",
			Relations: []domain.RCARelation{}, IsActive: true,
		},
		expectedClassType: domain.PEPInternationalOrg,
	},
	{
		name:             "International Org NATO",
		screeningCountry: "US",
		profile: domain.PEPProfile{
			EntityID: "pep-005", Country: "DE", Position: "NATO Secretary General",
			Relations: []domain.RCARelation{}, IsActive: true,
		},
		expectedClassType: domain.PEPInternationalOrg,
	},
	{
		name:             "Foreign PEP",
		screeningCountry: "US",
		profile: domain.PEPProfile{
			EntityID: "pep-006", Country: "RU", Position: "Foreign Minister",
			Relations: []domain.RCARelation{}, IsActive: true,
		},
		expectedClassType: domain.PEPForeign,
	},
	{
		name:             "Foreign PEP different screening country",
		screeningCountry: "SG",
		profile: domain.PEPProfile{
			EntityID: "pep-007", Country: "CN", Position: "Ambassador",
			Relations: []domain.RCARelation{}, IsActive: true,
		},
		expectedClassType: domain.PEPForeign,
	},
}
