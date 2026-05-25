package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// CorporateRegistryLists returns beneficial ownership and corporate
// registry data sources for UBO screening.
func CorporateRegistryLists() []domain.ListConfig {
	os := "https://data.opensanctions.org/datasets/latest/"
	return []domain.ListConfig{
		// OpenCorporates — global corporate registry
		lc("opencorp-global",
			os+"oc_companies/targets.simple.csv",
			"opensanctions_bulk", "0 1 * * 0"),

		// EU Beneficial Ownership Registers
		lc("eu-bor",
			os+"eu_bor/targets.simple.csv",
			"opensanctions_bulk", "0 2 * * 0"),

		// Luxembourg Business Register
		lc("lu-rcsl",
			os+"lu_rcsl/targets.simple.csv",
			"opensanctions_bulk", "0 2 * * 0"),

		// Cyprus Business Registry
		lc("cy-companies",
			os+"cy_companies/targets.simple.csv",
			"opensanctions_bulk", "0 3 * * 0"),

		// Liechtenstein FIU
		lc("li-fma",
			os+"li_fma/targets.simple.csv",
			"opensanctions_bulk", "0 3 * * 0"),

		// BVI Financial Services Commission
		lc("vg-fsc",
			os+"vg_fsc/targets.simple.csv",
			"opensanctions_bulk", "0 4 * * 0"),

		// Panama Public Registry
		lc("pa-registro",
			os+"pa_registro/targets.simple.csv",
			"opensanctions_bulk", "0 4 * * 0"),
	}
}
