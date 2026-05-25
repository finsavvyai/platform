package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// ExtendedPEPSources returns additional PEP and state-owned entity
// lists beyond the core OpenSanctions PEP dataset.
func ExtendedPEPSources() []domain.ListConfig {
	os := "https://data.opensanctions.org/datasets/latest/"
	return []domain.ListConfig{
		// UN Heads of State and Government
		lc("un-heads-of-state",
			os+"us_cia_world_leaders/targets.simple.csv",
			"opensanctions_bulk", "0 1 * * 1"),

		// Wikidata Legislators (global parliament members)
		lc("wikidata-legislators",
			os+"wd_legislators/targets.simple.csv",
			"opensanctions_bulk", "0 1 * * 1"),

		// Wikidata PEPs (broader — ministers, judges, generals)
		lc("wikidata-peps",
			os+"wd_peps/targets.simple.csv",
			"opensanctions_bulk", "0 2 * * 1"),

		// Rulers.org — heads of state historical
		lc("rulers-org",
			os+"us_rulers/targets.simple.csv",
			"opensanctions_bulk", "0 2 * * 1"),

		// US Specially Designated Globals (terrorism)
		lc("us-sdgt",
			os+"us_ofac_sdn/targets.simple.csv",
			"opensanctions_bulk", "0 3 * * *"),

		// UK Members of Parliament
		lc("uk-parliament",
			os+"gb_parliament/targets.simple.csv",
			"opensanctions_bulk", "0 3 * * 1"),

		// EU Members of Parliament
		lc("eu-parliament",
			os+"eu_meps/targets.simple.csv",
			"opensanctions_bulk", "0 4 * * 1"),

		// ICIJ Offshore Leaks entities
		lc("icij-offshore",
			os+"icij/targets.simple.csv",
			"opensanctions_bulk", "0 5 * * 1"),

		// Russian oligarchs and officials (multiple sources)
		lc("ru-oligarchs",
			os+"ru_rupep/targets.simple.csv",
			"opensanctions_bulk", "0 5 * * 1"),

		// OpenCorporates — state-owned enterprises
		lc("opencorp-soe",
			os+"oc_companies/targets.simple.csv",
			"opensanctions_bulk", "0 6 * * 1"),

		// NOTE: gleif_lei intentionally omitted. OS ext_gleif lists
		// 330K entities but publishes no downloadable resource;
		// native GLEIF ingest requires the paginated api.gleif.org
		// client (internal/ingestion/gleif_client.go), which is not
		// a URL→Parser pipeline and therefore unreachable from
		// reingest-global. Add a dedicated GLEIF job + register it
		// here when that lands.

		// UK Companies House PSC (Persons of Significant Control)
		lc("uk-psc",
			os+"gb_psc/targets.simple.csv",
			"opensanctions_bulk", "0 7 * * 1"),

		// Council of Europe Parliamentary Assembly (PEP-adjacent)
		lc("coe-assembly",
			"https://s3.us.archive.org/opensanctions/coe_assembly.csv",
			"opensanctions_bulk", "0 8 * * 1"),

		// Israeli MoD designated terrorists (OpenSanctions curated).
		// Complements our direct NBCTF feeds with OS-maintained aliases.
		lc("il-mod-terrorists",
			os+"il_mod_terrorists/targets.simple.csv",
			"opensanctions_bulk", "0 8 * * 1"),

		// Netherlands national terrorism sanctions list.
		lc("nl-terrorism",
			os+"nl_terrorism_list/targets.simple.csv",
			"opensanctions_bulk", "0 9 * * 1"),
	}
}
