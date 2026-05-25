package ingestion

// WikidataCountries maps ISO 3166-1 alpha-2 codes to Wikidata Q-numbers.
var WikidataCountries = map[string]string{
	"US": "Q30", "GB": "Q145", "FR": "Q142", "DE": "Q183", "IT": "Q38",
	"ES": "Q29", "PT": "Q45", "NL": "Q55", "BE": "Q31", "AT": "Q40",
	"CH": "Q39", "SE": "Q34", "NO": "Q20", "DK": "Q35", "FI": "Q33",
	"IE": "Q27", "PL": "Q36", "CZ": "Q213", "SK": "Q214", "HU": "Q28",
	"RO": "Q218", "BG": "Q219", "HR": "Q224", "SI": "Q215", "LT": "Q37",
	"LV": "Q211", "EE": "Q191", "GR": "Q41", "CY": "Q229", "MT": "Q233",
	"LU": "Q32", "IS": "Q189", "RU": "Q159", "UA": "Q212", "BY": "Q184",
	"RS": "Q403", "BA": "Q225", "ME": "Q236", "MK": "Q221", "AL": "Q222",
	"MD": "Q217", "GE": "Q230", "AM": "Q399", "AZ": "Q227", "TR": "Q43",
	"CN": "Q148", "JP": "Q17", "KR": "Q884", "KP": "Q423", "IN": "Q668",
	"PK": "Q843", "BD": "Q902", "LK": "Q854", "NP": "Q837", "MM": "Q836",
	"TH": "Q869", "VN": "Q881", "MY": "Q833", "SG": "Q334", "ID": "Q252",
	"PH": "Q928", "TW": "Q865", "MN": "Q711", "KZ": "Q232", "UZ": "Q265",
	"TM": "Q874", "KG": "Q813", "TJ": "Q863", "AF": "Q889", "IQ": "Q796",
	"IR": "Q794", "SA": "Q851", "AE": "Q878", "QA": "Q846", "KW": "Q817",
	"BH": "Q398", "OM": "Q842", "YE": "Q805", "JO": "Q810", "LB": "Q822",
	"SY": "Q858", "IL": "Q801", "PS": "Q219060", "EG": "Q79", "LY": "Q1016",
	"TN": "Q948", "DZ": "Q262", "MA": "Q1028", "NG": "Q1033", "GH": "Q117",
	"KE": "Q114", "ET": "Q115", "TZ": "Q924", "UG": "Q1036", "ZA": "Q258",
	"MZ": "Q1029", "ZW": "Q954", "AO": "Q916", "CD": "Q974", "CM": "Q1009",
	"CI": "Q1008", "SN": "Q1041", "ML": "Q912", "BF": "Q965", "NE": "Q1032",
	"TD": "Q657", "SD": "Q1049", "SS": "Q958", "SO": "Q1045", "RW": "Q1037",
	"BI": "Q967", "MG": "Q1019", "MW": "Q1020", "ZM": "Q953", "BW": "Q963",
	"NA": "Q1030", "GA": "Q1000", "CG": "Q971", "GQ": "Q983", "ER": "Q986",
	"DJ": "Q977", "BR": "Q155", "AR": "Q414", "CL": "Q298", "CO": "Q739",
	"PE": "Q419", "VE": "Q717", "EC": "Q736", "BO": "Q750", "PY": "Q733",
	"UY": "Q77", "GY": "Q734", "SR": "Q730", "MX": "Q96", "GT": "Q774",
	"HN": "Q783", "SV": "Q792", "NI": "Q811", "CR": "Q800", "PA": "Q804",
	"CU": "Q241", "DO": "Q786", "HT": "Q790", "JM": "Q766", "TT": "Q754",
	"CA": "Q16", "AU": "Q408", "NZ": "Q664", "FJ": "Q712", "PG": "Q691",
}

// GetQID returns the Wikidata Q-number for a country code, or empty.
func GetQID(countryCode string) string {
	return WikidataCountries[countryCode]
}

// AllCountryCodes returns all supported ISO country codes.
func AllCountryCodes() []string {
	codes := make([]string, 0, len(WikidataCountries))
	for code := range WikidataCountries {
		codes = append(codes, code)
	}
	return codes
}
