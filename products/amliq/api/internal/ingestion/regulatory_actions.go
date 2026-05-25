package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// RegulatoryActionLists returns financial regulator enforcement
// actions and debarment lists.
func RegulatoryActionLists() []domain.ListConfig {
	os := "https://data.opensanctions.org/datasets/latest/"
	return []domain.ListConfig{
		// US SEC enforcement actions
		lc("us-sec-enforcement",
			os+"us_sec/targets.simple.csv",
			"opensanctions_bulk", "0 8 * * 1"),

		// US FinCEN enforcement actions
		lc("us-fincen",
			os+"us_fincen/targets.simple.csv",
			"opensanctions_bulk", "0 8 * * 1"),

		// UK FCA warning list
		lc("uk-fca-warning",
			os+"gb_fca/targets.simple.csv",
			"opensanctions_bulk", "0 9 * * 1"),

		// US FDIC enforcement actions
		lc("us-fdic",
			os+"us_fdic/targets.simple.csv",
			"opensanctions_bulk", "0 9 * * 1"),

		// US OCC enforcement actions
		lc("us-occ",
			os+"us_occ/targets.simple.csv",
			"opensanctions_bulk", "0 10 * * 1"),

		// Australian AUSTRAC enforcement
		lc("au-austrac",
			os+"au_austrac/targets.simple.csv",
			"opensanctions_bulk", "0 10 * * 1"),

		// Canadian FINTRAC penalties
		lc("ca-fintrac",
			os+"ca_fintrac/targets.simple.csv",
			"opensanctions_bulk", "0 11 * * 1"),

		// German BaFin sanctions
		lc("de-bafin-actions",
			os+"de_bafin/targets.simple.csv",
			"opensanctions_bulk", "0 11 * * 1"),
	}
}
