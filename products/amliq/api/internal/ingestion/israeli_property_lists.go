package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// IsraeliPropertyLists returns NBCTF property seizure page configs.
// These are HTML pages that list seized property (real estate,
// vehicles, bank accounts, companies) linked to terror designations.
func IsraeliPropertyLists() []domain.ListConfig {
	return []domain.ListConfig{
		lc("il-nbctf-property",
			NBCTFPropertyURL,
			"nbctf_html", "0 11 * * 1"),
		lc("il-nbctf-realestate",
			NBCTFRealEstateURL,
			"nbctf_html", "0 11 * * 1"),
		lc("il-nbctf-vehicles",
			NBCTFVehiclesURL,
			"nbctf_html", "0 11 * * 1"),
		lc("il-nbctf-bank-accounts",
			NBCTFBankAccountsURL,
			"nbctf_html", "0 11 * * 1"),
		lc("il-nbctf-companies",
			NBCTFCompaniesURL,
			"nbctf_html", "0 11 * * 1"),
	}
}
