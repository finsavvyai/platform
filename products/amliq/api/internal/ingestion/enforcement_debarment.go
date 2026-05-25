package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// EnforcementAndDebarmentLists returns law enforcement, debarment,
// and development bank sanctions lists.
func EnforcementAndDebarmentLists() []domain.ListConfig {
	os := "https://data.opensanctions.org/datasets/latest/"
	return []domain.ListConfig{
		// World Bank debarred firms/individuals. The direct
		// worldbank.org/content/dam CSV returns 404 (removed in the
		// 2025 sanctions site reorganization). Use OpenSanctions mirror.
		lc("worldbank-debar",
			os+"worldbank_debarred/targets.simple.csv",
			"opensanctions_bulk", "0 1 * * 1"),

		// African Development Bank sanctions
		lc("afdb-debar",
			os+"afdb_sanctions/targets.simple.csv",
			"opensanctions_bulk", "0 1 * * 1"),

		// Asian Development Bank sanctions. ListID matches the
		// OpenSanctions dataset name (entities' list_id column).
		lc("adb_sanctions",
			os+"adb_sanctions/targets.simple.csv",
			"opensanctions_bulk", "0 2 * * 1"),

		// Inter-American Development Bank sanctions
		lc("iadb-debar",
			os+"iadb_sanctions/targets.simple.csv",
			"opensanctions_bulk", "0 2 * * 1"),

		// EBRD enforcement
		lc("ebrd-debar",
			os+"ebrd_sanctions/targets.simple.csv",
			"opensanctions_bulk", "0 3 * * 1"),

		// FBI Most Wanted (terrorism + fugitives). ListID matches the
		// canonical snake_case used in the OS mirror and older seeds.
		lc("fbi_most_wanted",
			"https://api.fbi.gov/@wanted?pageSize=200",
			"fbi_wanted", "0 4 * * *"),

		// FBI Lazarus Group crypto wallet indicators (North Korea DPRK
		// threat actors). Specific FBI feed separate from Most Wanted.
		lc("us_fbi_lazarus_crypto",
			os+"us_fbi_lazarus_crypto/targets.simple.csv",
			"opensanctions_bulk", "0 4 * * *"),

		// Interpol Red Notices
		lc("interpol-red",
			os+"interpol_red/targets.simple.csv",
			"opensanctions_bulk", "0 5 * * *"),

		// Europol Most Wanted
		lc("europol-wanted",
			os+"eu_europol/targets.simple.csv",
			"opensanctions_bulk", "0 5 * * *"),

		// US BIS Denied Persons List. Direct bis.doc.gov/dpl/dpl.txt
		// was deprecated in the bis.gov migration and now serves the
		// site homepage (HTML). Use OpenSanctions bulk mirror.
		lc("us-bis-denied",
			os+"us_bis_denied/targets.simple.csv",
			"opensanctions_bulk", "0 6 * * 1"),

		// US BIS Unverified List
		lc("us-bis-unverified",
			os+"us_bis_unverified/targets.simple.csv",
			"opensanctions_bulk", "0 6 * * 1"),

		// US Military End User List
		lc("us-bis-meu",
			os+"us_bis_meu/targets.simple.csv",
			"opensanctions_bulk", "0 7 * * 1"),
	}
}
