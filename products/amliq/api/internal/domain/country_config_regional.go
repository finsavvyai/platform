package domain

func israeliLists() []ListConfig {
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
			ListID:       "israeli_mod",
			SourceURL:    "https://nbctf.mod.gov.il/he/Terror/pages/organizationsandindividuals.aspx",
			ParserType:   "israeli_mod",
			SyncSchedule: "0 4 * * *",
			SyncEnabled:  true,
			Threshold:    0.75,
		},
		{
			ListID:       "un",
			SourceURL:    "https://www.un.org/sc/suborg/en/sanctions/un-sc-consolidated-list",
			ParserType:   "un",
			SyncSchedule: "0 5 * * *",
			SyncEnabled:  true,
			Threshold:    0.72,
		},
	}
}

func ukLists() []ListConfig {
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
		{
			ListID:       "uk_ofsi",
			SourceURL:    "https://www.gov.uk/government/publications/the-uk-sanctions-list",
			ParserType:   "uk_ofsi",
			SyncSchedule: "0 5 * * *",
			SyncEnabled:  true,
			Threshold:    0.72,
		},
	}
}

func swissLists() []ListConfig {
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
			ListID:       "seco",
			SourceURL:    "https://www.seco.admin.ch/seco/en/public/swiss-criminal-law/international-sanctions.html",
			ParserType:   "seco",
			SyncSchedule: "0 4 * * *",
			SyncEnabled:  true,
			Threshold:    0.72,
		},
	}
}
