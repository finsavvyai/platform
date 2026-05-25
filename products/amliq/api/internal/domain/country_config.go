package domain

// SuggestedLists returns recommended list configurations for a country.
func SuggestedLists(countryCode string) []ListConfig {
	switch countryCode {
	case "IL":
		return israeliLists()
	case "GB":
		return ukLists()
	case "DE", "FR", "IT", "ES":
		return europeanLists()
	case "CH":
		return swissLists()
	default:
		return defaultLists()
	}
}

func defaultLists() []ListConfig {
	return []ListConfig{
		{
			ListID:       "ofac-sdn",
			SourceURL:    "https://www.treasury.gov/ofac/downloads/sdn.csv",
			ParserType:   "ofac",
			SyncSchedule: "0 3 * * *",
			SyncEnabled:  true,
			Threshold:    0.7,
		},
		{
			ListID:       "eu_fsf",
			SourceURL:    "https://webgate.ec.europa.eu/fsd/fsf/public/files/csvFullSanctionsList/content?token=dG9rZW4tMjAxNw",
			ParserType:   "eu",
			SyncSchedule: "0 4 * * *",
			SyncEnabled:  true,
			Threshold:    0.7,
		},
		{
			ListID:       "un",
			SourceURL:    "https://scsanctions.un.org/resources/xml/en/consolidated.xml",
			ParserType:   "un",
			SyncSchedule: "0 5 * * *",
			SyncEnabled:  true,
			Threshold:    0.72,
		},
	}
}

func europeanLists() []ListConfig {
	return []ListConfig{
		{
			ListID:       "ofac",
			SourceURL:    "https://www.treasury.gov/resource-center/sanctions/sdn/pages/default.aspx",
			ParserType:   "ofac",
			SyncSchedule: "0 3 * * *",
			SyncEnabled:  true,
			Threshold:    0.7,
		},
		{
			ListID:       "eu_fsf",
			SourceURL:    "https://webgate.ec.europa.eu/cfca/publiclist/",
			ParserType:   "eu",
			SyncSchedule: "0 4 * * *",
			SyncEnabled:  true,
			Threshold:    0.7,
		},
	}
}
