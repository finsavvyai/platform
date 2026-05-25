package domain

// RegulatoryProfile defines compliance requirements per country.
type RegulatoryProfile struct {
	Country         string
	Regulator       string
	RequiredLists   []string
	PEPScope        string // "foreign_only", "all", "all_plus_domestic"
	ReportingBody   string // where to file SARs/STRs
	ReportingFormat string // "sar", "str", "smr"
	RetentionYears  int
	Languages       []string
}

// CountryProfiles maps ISO country codes to regulatory requirements.
var CountryProfiles = map[string]RegulatoryProfile{
	"US": {Country: "US", Regulator: "FinCEN/OFAC", RequiredLists: []string{"us_ofac_sdn", "us_ofac_cons", "un_sc_sanctions"}, PEPScope: "foreign_only", ReportingBody: "FinCEN", ReportingFormat: "sar", RetentionYears: 5, Languages: []string{"en"}},
	"GB": {Country: "GB", Regulator: "FCA/OFSI", RequiredLists: []string{"uk_ofsi", "un_sc_sanctions", "eu_fsf"}, PEPScope: "all", ReportingBody: "NCA", ReportingFormat: "sar", RetentionYears: 5, Languages: []string{"en"}},
	"IL": {Country: "IL", Regulator: "IMPA", RequiredLists: []string{"il_nbctf", "us_ofac_sdn", "un_sc_sanctions", "eu_fsf"}, PEPScope: "all", ReportingBody: "IMPA", ReportingFormat: "str", RetentionYears: 7, Languages: []string{"he", "en", "ar"}},
	"DE": {Country: "DE", Regulator: "BaFin", RequiredLists: []string{"eu_fsf", "un_sc_sanctions", "us_ofac_sdn"}, PEPScope: "all", ReportingBody: "FIU", ReportingFormat: "str", RetentionYears: 5, Languages: []string{"de", "en"}},
	"FR": {Country: "FR", Regulator: "ACPR", RequiredLists: []string{"eu_fsf", "un_sc_sanctions", "fr_sdfm"}, PEPScope: "all", ReportingBody: "TRACFIN", ReportingFormat: "str", RetentionYears: 5, Languages: []string{"fr", "en"}},
	"SG": {Country: "SG", Regulator: "MAS", RequiredLists: []string{"sg_mas", "un_sc_sanctions", "us_ofac_sdn"}, PEPScope: "foreign_only", ReportingBody: "STRO", ReportingFormat: "str", RetentionYears: 5, Languages: []string{"en"}},
	"AE": {Country: "AE", Regulator: "CBUAE", RequiredLists: []string{"ae_cbuae", "un_sc_sanctions", "us_ofac_sdn"}, PEPScope: "all", ReportingBody: "goAML", ReportingFormat: "str", RetentionYears: 5, Languages: []string{"ar", "en"}},
	"AU": {Country: "AU", Regulator: "AUSTRAC", RequiredLists: []string{"au_dfat", "un_sc_sanctions"}, PEPScope: "foreign_only", ReportingBody: "AUSTRAC", ReportingFormat: "smr", RetentionYears: 7, Languages: []string{"en"}},
	"CA": {Country: "CA", Regulator: "FINTRAC", RequiredLists: []string{"ca_osfi", "un_sc_sanctions", "us_ofac_sdn"}, PEPScope: "all", ReportingBody: "FINTRAC", ReportingFormat: "str", RetentionYears: 5, Languages: []string{"en", "fr"}},
	"JP": {Country: "JP", Regulator: "JFSA", RequiredLists: []string{"jp_mof", "un_sc_sanctions"}, PEPScope: "foreign_only", ReportingBody: "JAFIC", ReportingFormat: "str", RetentionYears: 7, Languages: []string{"ja", "en"}},
	"KR": {Country: "KR", Regulator: "KoFIU/FSS", RequiredLists: []string{"kr_kofiu", "un_sc_sanctions", "us_ofac_sdn"}, PEPScope: "all", ReportingBody: "KoFIU", ReportingFormat: "str", RetentionYears: 5, Languages: []string{"ko", "en"}},
	"IN": {Country: "IN", Regulator: "RBI/FIU-IND", RequiredLists: []string{"in_rbi", "un_sc_sanctions"}, PEPScope: "foreign_only", ReportingBody: "FIU-IND", ReportingFormat: "str", RetentionYears: 5, Languages: []string{"en", "hi"}},
	"BR": {Country: "BR", Regulator: "COAF/BCB", RequiredLists: []string{"br_coaf", "un_sc_sanctions"}, PEPScope: "all", ReportingBody: "COAF", ReportingFormat: "str", RetentionYears: 5, Languages: []string{"pt", "en"}},
	"SA": {Country: "SA", Regulator: "SAMA", RequiredLists: []string{"sa_sama", "un_sc_sanctions", "us_ofac_sdn"}, PEPScope: "all", ReportingBody: "SAFIU", ReportingFormat: "str", RetentionYears: 10, Languages: []string{"ar", "en"}},
	"CH": {Country: "CH", Regulator: "FINMA", RequiredLists: []string{"ch_seco", "un_sc_sanctions", "eu_fsf"}, PEPScope: "all", ReportingBody: "MROS", ReportingFormat: "str", RetentionYears: 10, Languages: []string{"de", "fr", "it", "en"}},
	"ZA": {Country: "ZA", Regulator: "FIC", RequiredLists: []string{"za_fic", "un_sc_sanctions"}, PEPScope: "all", ReportingBody: "FIC", ReportingFormat: "str", RetentionYears: 5, Languages: []string{"en"}},
}

// GetRegulatoryProfile returns the profile for a country.
func GetRegulatoryProfile(country string) *RegulatoryProfile {
	p, ok := CountryProfiles[country]
	if !ok {
		return &RegulatoryProfile{
			Country: country, Regulator: "Local FIU",
			RequiredLists:   []string{"un_sc_sanctions", "us_ofac_sdn"},
			PEPScope:        "foreign_only",
			ReportingFormat: "str", RetentionYears: 5,
			Languages: []string{"en"},
		}
	}
	return &p
}
