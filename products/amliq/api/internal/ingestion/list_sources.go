package ingestion

// ListSourceEntry describes a sanctions/PEP data source.
type ListSourceEntry struct {
	ID     string
	Name   string
	URL    string
	Parser string
}

// AllSources returns every supported sanctions list source.
// OpenSanctions combined covers all individual sources + 300 more.
var AllSources = []ListSourceEntry{
	// Major Powers
	{ID: "us_ofac_sdn", Name: "US OFAC SDN", URL: "https://www.treasury.gov/ofac/downloads/sdn_advanced.xml", Parser: "ofac_advanced"},
	{ID: "us_ofac_cons", Name: "US OFAC Consolidated", URL: "https://www.treasury.gov/ofac/downloads/consolidated/cons_prim.csv", Parser: "ofac"},
	{ID: "un_sc_sanctions", Name: "UN Security Council", URL: "https://scsanctions.un.org/resources/xml/en/consolidated.xml", Parser: "un"},
	{ID: "eu_fsf", Name: "EU Financial Sanctions", URL: "https://webgate.ec.europa.eu/fsd/fsf/public/files/csvFullSanctionsList/content", Parser: "eu"},
	{ID: "uk_ofsi", Name: "UK OFSI", URL: "https://ofsistorage.blob.core.windows.net/publishlive/ConList.csv", Parser: "uk_ofsi"},
	{ID: "ch_seco", Name: "Swiss SECO", URL: "https://www.seco.admin.ch/sanctions", Parser: "seco"},
	{ID: "il_nbctf", Name: "Israel NBCTF", URL: "https://nbctf.mod.gov.il/he/Sanctions/Lists", Parser: "nbctf"},
	// Asia-Pacific
	{ID: "au_dfat", Name: "Australia DFAT", URL: "https://www.dfat.gov.au/sites/default/files/regulation8_consolidated.csv", Parser: "opensanctions"},
	{ID: "jp_mof", Name: "Japan MOF", URL: "", Parser: "opensanctions"},
	{ID: "sg_mas", Name: "Singapore MAS", URL: "", Parser: "opensanctions"},
	{ID: "hk_hkma", Name: "Hong Kong HKMA", URL: "", Parser: "opensanctions"},
	{ID: "kr_kofiu", Name: "South Korea KoFIU", URL: "", Parser: "opensanctions"},
	{ID: "in_rbi", Name: "India RBI", URL: "", Parser: "opensanctions"},
	// Middle East
	{ID: "ae_cbuae", Name: "UAE Central Bank", URL: "", Parser: "opensanctions"},
	{ID: "sa_sama", Name: "Saudi Arabia SAMA", URL: "", Parser: "opensanctions"},
	{ID: "il_mod", Name: "Israel MOD", URL: "https://nbctf.mod.gov.il/he/Sanctions/Lists", Parser: "israeli_mod"},
	// Americas
	{ID: "ca_osfi", Name: "Canada OSFI", URL: "https://www.international.gc.ca/world-monde/international_relations-relations_internationales/sanctions/consolidated-consolide.aspx", Parser: "opensanctions"},
	{ID: "br_coaf", Name: "Brazil COAF", URL: "", Parser: "opensanctions"},
	// Africa
	{ID: "za_fic", Name: "South Africa FIC", URL: "", Parser: "opensanctions"},
	// OpenSanctions Combined (covers ALL above + 300+ more)
	{ID: "opensanctions_default", Name: "OpenSanctions Combined", URL: NestedDataURL, Parser: "opensanctions_nested"},
	{ID: "opensanctions_peps", Name: "OpenSanctions PEPs", URL: PEPDataURL, Parser: "opensanctions_pep"},
	// Wikidata sources
	{ID: "wikidata_peps", Name: "Wikidata PEPs", URL: sparqlEndpoint, Parser: "wikidata_pep"},
	{ID: "wikidata_soe", Name: "Wikidata SOEs", URL: sparqlEndpoint, Parser: "wikidata_soe"},
	// Adverse media
	{ID: "adverse_media", Name: "Adverse Media Entities", URL: "", Parser: "adverse_media"},
	// Additional sources
	{ID: "worldbank_debarred", Name: "World Bank Debarred", URL: "https://www.worldbank.org/en/projects-operations/procurement/debarred-firms", Parser: "worldbank"},
	{ID: "us_bis_denied", Name: "US BIS Denied Persons", URL: "https://www.bis.doc.gov/dpl/dpl.txt", Parser: "bis_denied"},
	{ID: "europol_wanted", Name: "Europol Most Wanted", URL: "https://eumostwanted.eu/api/wanted", Parser: "europol"},
	{ID: "fbi_wanted", Name: "FBI Most Wanted", URL: "https://api.fbi.gov/wanted/v1/list", Parser: "fbi_wanted"},
	{ID: "uk_hmt", Name: "UK HMT Consolidated", URL: "https://www.gov.uk/government/publications/financial-sanctions-consolidated-list-of-targets", Parser: "uk_hmt"},
	{ID: "nz_police_terror", Name: "NZ Police Terror List", URL: "https://www.police.govt.nz/advice/personal-community/counterterrorism/designated-entities", Parser: "nz_police"},
	{ID: "hk_hkma_sanctions", Name: "Hong Kong HKMA Sanctions", URL: "https://www.hkma.gov.hk/eng/regulatory-resources/", Parser: "hk_hkma"},
	// Corporate registries
	{ID: "opencorp_global", Name: "OpenCorporates Global", URL: "", Parser: "opensanctions"},
	{ID: "eu_bor", Name: "EU Beneficial Ownership", URL: "", Parser: "opensanctions"},
	{ID: "gleif_lei", Name: "GLEIF LEI Registry", URL: "", Parser: "opensanctions"},
	// Regulatory enforcement
	{ID: "us_sec", Name: "US SEC Enforcement", URL: "", Parser: "opensanctions"},
	{ID: "us_fincen", Name: "US FinCEN Enforcement", URL: "", Parser: "opensanctions"},
	{ID: "uk_fca", Name: "UK FCA Warning List", URL: "", Parser: "opensanctions"},
	{ID: "au_austrac", Name: "Australia AUSTRAC", URL: "", Parser: "opensanctions"},
	{ID: "ca_fintrac", Name: "Canada FINTRAC", URL: "", Parser: "opensanctions"},
	// FATF grey/blacklist (metadata only — risk scoring)
	{ID: "fatf_lists", Name: "FATF Grey/Blacklist", URL: "", Parser: "fatf"},
	// ICIJ Offshore Leaks
	{ID: "icij_offshore", Name: "ICIJ Offshore Leaks", URL: "", Parser: "opensanctions"},
}

// SourceByID returns the source with the given ID, or nil.
func SourceByID(id string) *ListSourceEntry {
	for i := range AllSources {
		if AllSources[i].ID == id {
			return &AllSources[i]
		}
	}
	return nil
}

// SourceCount returns the total number of registered sources.
func SourceCount() int {
	return len(AllSources)
}
