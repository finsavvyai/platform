package ingestion

// RegisterExtendedParsers adds every parser type referenced by
// ListConfig entries in AllMajorLists() + ExpandedLists() so that
// a global reingest can look up a parser for any list by its
// ParserType string alone. Kept separate from RegisterBulkParsers
// to keep each file under the 100-line project rule.
func RegisterExtendedParsers(tr *TypeRegistry) {
	// Primary sanctions parsers (one per country/regulator).
	tr.RegisterType("eu", NewEUParser())
	tr.RegisterType("un", NewUNParser())
	tr.RegisterType("uk_ofsi", NewUKOFSIParser())
	tr.RegisterType("swiss", NewSECOParser())
	tr.RegisterType("seco", NewSECOParser())
	tr.RegisterType("sdfm", NewSDFMParser())
	tr.RegisterType("au_dfat", NewAuDFATParser())
	tr.RegisterType("ca_osfi", NewCanadaOSFIParser())
	tr.RegisterType("jp_mof", NewJapanMOFParser())
	tr.RegisterType("sg_mas", NewSingaporeMASParser())
	tr.RegisterType("kr_kofiu", NewKoreaKOFIUParser())
	tr.RegisterType("ae_cbuae", NewUAECBParser())
	tr.RegisterType("in_rbi", NewIndiaRBIParser())
	tr.RegisterType("br_coaf", NewBrazilCOAFParser())
	tr.RegisterType("za_fic", NewSouthAfricaFICParser())
	tr.RegisterType("custom_csv", NewCustomParser())

	// Enrichment sources that match the Parser interface.
	tr.RegisterType("interpol", NewInterpolParser())

	// Development-bank + corporate debarment / registry sources.
	tr.RegisterType("adb", NewADBParser())
	tr.RegisterType("ebrd", NewEBRDParser())
	tr.RegisterType("gleif", NewGLEIFParser())
	tr.RegisterType("icij", NewICIJParser())
	tr.RegisterType("sam_gov", NewSAMGovParser())
	tr.RegisterType("uk_psc", NewUKPSCParser())

	// OpenSanctions family aliases.
	tr.RegisterType("opensanctions_alias", NewOpenSanctionsAliasParser())
	tr.RegisterType("europol_opensanctions", NewEuropolOpenSanctionsParser())
	tr.RegisterType("bis_opensanctions", NewBISOpenSanctionsParser())
}
