package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// RegisterAllParsers registers all built-in parsers including
// OpenSanctions bulk and PEP parsers into the given registry.
func RegisterAllParsers(reg *Registry) {
	// Advanced XML parser is the default for OFAC — the sdn_advanced.xml
	// feed is the richest OFAC source and what all_lists.go points at.
	reg.Register(domain.ListSourceOFAC, NewOFACAdvancedParser())
	reg.Register(domain.ListSourceOpenSanctions, NewOpenSanctionsNestedParser())
}

// RegisterBulkParsers registers OpenSanctions bulk + PEP parsers
// into a TypeRegistry for string-based parser lookup.
func RegisterBulkParsers(tr *TypeRegistry) {
	tr.RegisterType("ofac", NewOFACParser())
	tr.RegisterType("ofac_advanced", NewOFACAdvancedParser())
	tr.RegisterType("opensanctions_bulk", NewOpenSanctionsBulkParser())
	tr.RegisterType("opensanctions_nested", NewOpenSanctionsNestedParser())
	tr.RegisterType("opensanctions_pep", NewOpenSanctionsPEPParser())
	tr.RegisterType("opensanctions_pep_ftm", NewOpenSanctionsPEPFTMParser())
	tr.RegisterType("gleif_xml", NewGLEIFXMLParser())
	tr.RegisterType("opensanctions", NewOpenSanctionsParser())
	tr.RegisterType("worldbank", NewWorldBankParser())
	tr.RegisterType("bis_denied", NewBISDeniedParser())
	tr.RegisterType("europol", NewEuropolParser())
	tr.RegisterType("fbi_wanted", NewFBIMostWantedParser())
	tr.RegisterType("uk_hmt", NewUKHMTParser())
	tr.RegisterType("nz_police", NewNZPoliceParser())
	tr.RegisterType("hk_hkma", NewHKSanctionsParser())
	tr.RegisterType("nbctf", NewNBCTFParser())
	tr.RegisterType("nbctf_html", NewNBCTFParser())
	tr.RegisterType("nbctf_xml", NewNBCTFXMLParser())
	tr.RegisterType("israeli_treasury", NewIsraeliTreasuryParser())
	tr.RegisterType("israeli_mod", NewIsraeliMoDParser())
	tr.RegisterType("wikidata_il_mayors", NewWikidataILMayorsParser())
	tr.RegisterType("wikidata_il_judiciary", NewWikidataILJudiciaryParser())
	tr.RegisterType("knesset_persons", NewKnessetPersonsParser())
}
