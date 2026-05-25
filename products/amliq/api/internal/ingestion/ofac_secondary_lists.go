package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// OFACSecondaryLists returns OFAC non-SDN sanctions lists.
// These are critical for comprehensive US sanctions coverage.
func OFACSecondaryLists() []domain.ListConfig {
	base := "https://www.treasury.gov/ofac/downloads/"
	os := "https://data.opensanctions.org/datasets/latest/"
	return []domain.ListConfig{
		lc("ofac-cons", base+"consolidated/consolidated.csv",
			"ofac", "0 3 * * *"),
		lc("ofac-ssi", os+"us_ofac_ssi/targets.simple.csv",
			"opensanctions_bulk", "0 3 * * *"),
		lc("ofac-ns-mbs", base+"ns-mbs.csv",
			"ofac", "0 3 * * *"),
		lc("ofac-capta", base+"capta.csv",
			"ofac", "0 3 * * *"),
		lc("ofac-fse", base+"fse/fse.csv",
			"ofac", "0 3 * * *"),
		lc("ofac-561", base+"561list.csv",
			"ofac", "0 4 * * *"),
		lc("ofac-plc", base+"plc_pglc.csv",
			"ofac", "0 4 * * *"),
		// BIS Entity List (export controls)
		lc("us-bis-entity", "https://www.bis.doc.gov/entities/default.htm",
			"generic_csv", "0 5 * * 1"),
		// US SAM.gov Exclusions (debarred contractors). Direct
		// sam.gov fileextract endpoint is unreliable (intermittent
		// 500s during gov.uk/SAM maintenance). Use OS mirror.
		lc("us-sam-exclusions",
			os+"us_sam_exclusions/targets.simple.csv",
			"opensanctions_bulk", "0 5 * * *"),
	}
}

func lc(id, url, parser, sched string) domain.ListConfig {
	return domain.ListConfig{
		ListID: id, SourceURL: url,
		ParserType: parser, SyncSchedule: sched,
		SyncEnabled: true, Threshold: 0.7,
	}
}
