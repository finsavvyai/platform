package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// AllMajorLists returns ListConfigs for every supported sanctions list.
// Used by auto-load and admin refresh to ensure all lists are loaded
// regardless of tenant configuration.
func AllMajorLists() []domain.ListConfig {
	all := append(sanctionsLists(), pepLists()...)
	return append(all, cryptoLists()...)
}

func sanctionsLists() []domain.ListConfig {
	return []domain.ListConfig{
		{ListID: "ofac-sdn", SourceURL: "https://www.treasury.gov/ofac/downloads/sdn_advanced.xml",
			ParserType: "ofac_advanced", SyncSchedule: "0 3 * * *", SyncEnabled: true, Threshold: 0.7},
		{ListID: "opensanctions_default", SourceURL: NestedDataURL,
			ParserType: "opensanctions_nested", SyncSchedule: "0 3 * * *", SyncEnabled: true, Threshold: 0.7},
		{ListID: "eu_fsf", SourceURL: "https://webgate.ec.europa.eu/fsd/fsf/public/files/csvFullSanctionsList/content?token=dG9rZW4tMjAxNw",
			ParserType: "eu", SyncSchedule: "0 4 * * *", SyncEnabled: true, Threshold: 0.7},
		{ListID: "un", SourceURL: "https://scsanctions.un.org/resources/xml/en/consolidated.xml",
			ParserType: "un", SyncSchedule: "0 5 * * *", SyncEnabled: true, Threshold: 0.72},
		// UK OFSI: CSV feed, not the landing page. gov.uk page is HTML
		// and makes the parser return 0 entities. This is the canonical
		// published CSV the UK Treasury keeps current.
		{ListID: "uk_ofsi", SourceURL: "https://ofsistorage.blob.core.windows.net/publishlive/2022format/ConList.csv",
			ParserType: "uk_ofsi", SyncSchedule: "0 6 * * *", SyncEnabled: true, Threshold: 0.72},
		{ListID: "seco", SourceURL: "https://www.sesam.search.admin.ch/sesam-search-web/pages/downloadXmlGesamtliste.xhtml?lang=en&action=downloadXmlGesamtlisteAction",
			ParserType: "swiss", SyncSchedule: "0 7 * * *", SyncEnabled: true, Threshold: 0.72},
		// Israel — NBCTF (CSV primary, XML fallback)
		{ListID: "israeli_nbctf_orgs", SourceURL: NBCTFOrgsURL,
			ParserType: "nbctf", SyncSchedule: "0 9 * * 1", SyncEnabled: true, Threshold: 0.7},
		{ListID: "israeli_nbctf_individuals", SourceURL: NBCTFIndividualsURL,
			ParserType: "nbctf", SyncSchedule: "0 9 * * 1", SyncEnabled: true, Threshold: 0.7},
		{ListID: "israeli_nbctf_orgs_xml", SourceURL: NBCTFOrgsXML,
			ParserType: "nbctf_xml", SyncSchedule: "0 10 * * 1", SyncEnabled: true, Threshold: 0.7},
		{ListID: "israeli_nbctf_individuals_xml", SourceURL: NBCTFIndividualsXML,
			ParserType: "nbctf_xml", SyncSchedule: "0 10 * * 1", SyncEnabled: true, Threshold: 0.7},
		// Israel — Treasury sanctions HQ
		{ListID: "israeli_treasury", SourceURL: IsraeliTreasuryURL,
			ParserType: "israeli_treasury", SyncSchedule: "0 9 * * 1", SyncEnabled: true, Threshold: 0.7},
		// Israel — MoD NBCTF landing page (Incapsula-protected HTML).
		// Actual data is covered by the 4 nbctf csv/xml entries above;
		// this listing page has no direct download. Disabled to avoid
		// false-failed alerts.
		{ListID: "israeli_mod", SourceURL: IsraeliMoDURL,
			ParserType: "israeli_mod", SyncSchedule: "0 9 * * 1", SyncEnabled: false, Threshold: 0.7},
	}
}

func cryptoLists() []domain.ListConfig {
	var out []domain.ListConfig
	for _, src := range OFACSources() {
		out = append(out, domain.ListConfig{
			ListID: src.ID, SourceURL: src.URL,
			ParserType:   "crypto_text",
			SyncSchedule: "0 2 * * *",
			SyncEnabled:  true, Threshold: 1.0,
		})
	}
	return out
}

func pepLists() []domain.ListConfig {
	return []domain.ListConfig{
		// OpenSanctions PEPs via the FTM JSON-lines feed. The simple.csv
		// projection caps DOB coverage at ~17% because most birthDate
		// values only live inside the richer property map; FTM lifts
		// that ceiling to the dataset's native coverage.
		{ListID: "opensanctions_peps", SourceURL: PEPFTMDataURL,
			ParserType: "opensanctions_pep_ftm", SyncSchedule: "0 2 * * *", SyncEnabled: true, Threshold: 0.7},
		{ListID: "everypolitician", SourceURL: "https://data.opensanctions.org/datasets/latest/everypolitician/targets.simple.csv",
			ParserType: "opensanctions_bulk", SyncSchedule: "0 2 * * 1", SyncEnabled: true, Threshold: 0.7},
		{ListID: "cia_world_leaders", SourceURL: "https://data.opensanctions.org/datasets/latest/us_cia_world_leaders/targets.simple.csv",
			ParserType: "opensanctions_bulk", SyncSchedule: "0 2 * * 1", SyncEnabled: true, Threshold: 0.7},
		// Israeli mayors (current + historical) from Wikidata SPARQL.
		// Tier-3 PEPs per FATF — local government heads. Refine SPARQL
		// in wikidata_il_mayors.go if coverage looks low; Wikidata's
		// modeling of mayoral positions is inconsistent across cities.
		{ListID: "wikidata_il_mayors", SourceURL: WikidataILMayorsURL,
			ParserType: "wikidata_il_mayors", SyncSchedule: "0 3 * * 1", SyncEnabled: true, Threshold: 0.7},
		// Knesset members + ministers + speakers, current and historical.
		// Official OData feed at knesset.gov.il, ~1,184 persons. Tier-1
		// PEPs (national legislature). Full coverage of Israeli national
		// political class — fills the gap left by everypolitician (which
		// only carries 5 IL entries).
		{ListID: "knesset_persons", SourceURL: KnessetPersonsURL,
			ParserType: "knesset_persons", SyncSchedule: "0 4 * * 1", SyncEnabled: true, Threshold: 0.7},
		// Israeli judiciary + central bank from Wikidata (judges,
		// justices, central bankers). Tier-2 PEPs. ~580+ persons.
		// Refine occupation Q-IDs in wikidata_il_judiciary.go to widen
		// (prosecutors, AGs) when you have demand.
		{ListID: "wikidata_il_judiciary", SourceURL: WikidataILJudiciaryURL,
			ParserType: "wikidata_il_judiciary", SyncSchedule: "0 5 * * 1", SyncEnabled: true, Threshold: 0.7},
	}
}
