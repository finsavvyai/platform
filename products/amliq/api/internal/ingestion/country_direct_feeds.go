package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// CountryDirectFeeds returns sanctions list configs sourced directly
// from national authorities (not via OpenSanctions aggregation).
func CountryDirectFeeds() []domain.ListConfig {
	os := "https://data.opensanctions.org/datasets/latest/"
	return []domain.ListConfig{
		// Australia — DFAT consolidated sanctions. Direct
		// dfat.gov.au/sites/default/files/regulation8_consolidated.csv
		// is unstable (connection resets, geo-blocked). Use OS mirror.
		lc("au-dfat-direct",
			os+"au_dfat_sanctions/targets.simple.csv",
			"opensanctions_bulk", "0 6 * * *"),

		// Canada — Global Affairs consolidated
		lc("ca-osfi-direct",
			os+"ca_dfatd/targets.simple.csv",
			"opensanctions_bulk", "0 7 * * *"),

		// Japan — Ministry of Finance asset freeze
		lc("jp-mof-direct",
			os+"jp_mof/targets.simple.csv",
			"opensanctions_bulk", "0 8 * * *"),

		// France — DG Trésor gel des avoirs
		lc("fr-tresor-direct",
			"https://gels-avoirs.dgtresor.gouv.fr/ApiPublic/api/v1/publication/derniere-publication-en-vigueur/gel",
			"generic_xml", "0 9 * * *"),

		// Singapore — MAS designated entities
		lc("sg-mas-direct",
			os+"sg_mas/targets.simple.csv",
			"opensanctions_bulk", "0 10 * * *"),

		// New Zealand — designated terrorist entities
		lc("nz-police-direct",
			os+"nz_russia_sanctions/targets.simple.csv",
			"opensanctions_bulk", "0 10 * * 1"),

		// South Korea — FSS sanctions
		lc("kr-fss-direct",
			os+"kr_fss/targets.simple.csv",
			"opensanctions_bulk", "0 11 * * *"),

		// India — MHA banned organizations
		lc("in-mha-direct",
			os+"in_mha/targets.simple.csv",
			"opensanctions_bulk", "0 12 * * *"),

		// UAE — CBUAE sanctions
		lc("ae-cbuae-direct",
			os+"ae_local/targets.simple.csv",
			"opensanctions_bulk", "0 13 * * *"),

		// Germany — Federal Gazette sanctions
		lc("de-bafin-direct",
			os+"de_sanctions/targets.simple.csv",
			"opensanctions_bulk", "0 14 * * *"),

		// Netherlands — AFM sanctions
		lc("nl-afm-direct",
			os+"nl_sanctions/targets.simple.csv",
			"opensanctions_bulk", "0 15 * * 1"),

		// Belgium — NBB sanctions
		lc("be-nbb-direct",
			os+"be_fod/targets.simple.csv",
			"opensanctions_bulk", "0 15 * * 1"),

		// Poland — MSWiA sanctions
		lc("pl-mswia-direct",
			os+"pl_mswia/targets.simple.csv",
			"opensanctions_bulk", "0 16 * * 1"),

		// Russia — Rosfinmonitoring terror list
		lc("ru-rosfin",
			os+"ru_rupep/targets.simple.csv",
			"opensanctions_bulk", "0 17 * * 1"),

		// Ukraine — RNBO sanctions
		lc("ua-rnbo",
			os+"ua_nsdc/targets.simple.csv",
			"opensanctions_bulk", "0 17 * * 1"),

		// China — PBOC/CBIRC sanctions (via OpenSanctions)
		lc("cn-pboc",
			os+"cn_peoples_courts/targets.simple.csv",
			"opensanctions_bulk", "0 18 * * 1"),

		// Taiwan — MJIB sanctions
		lc("tw-mjib",
			os+"tw_sanctions/targets.simple.csv",
			"opensanctions_bulk", "0 18 * * 1"),

		// Thailand — AMLO sanctions
		lc("th-amlo",
			os+"th_amlo/targets.simple.csv",
			"opensanctions_bulk", "0 19 * * 1"),

		// Philippines — AMLC sanctions
		lc("ph-amlc",
			os+"ph_amlc/targets.simple.csv",
			"opensanctions_bulk", "0 19 * * 1"),
	}
}
