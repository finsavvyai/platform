package domain

// Extended list source names and parsing for new sanctions lists.
var extendedListSources = map[ListSource]string{
	ListSourceDFAT:         "DFAT",
	ListSourceCanada:       "Canada",
	ListSourceJapan:        "Japan",
	ListSourceMAS:          "MAS",
	ListSourceHKMA:         "HKMA",
	ListSourceFranceTresor: "FranceTresor",
	ListSourceInterpol:     "Interpol",
	ListSourceWorldBank:    "WorldBank",
	ListSourceKorea:        "Korea",
	ListSourceBrazil:       "Brazil",
	ListSourceIndia:        "India",
	ListSourceUAE:          "UAE",
	ListSourceSouthAfrica:  "SouthAfrica",
	ListSourceFATF:         "FATF",
	ListSourceBIS:          "BIS",
	ListSourceEuropol:      "Europol",
	ListSourceFBI:          "FBI",
	ListSourceUKHMT:        "UKHMT",
	ListSourceNZPolice:     "NZPolice",
}

func init() {
	// Register extended source names in reverse lookup.
	for src, name := range extendedListSources {
		extendedListSourcesByName[name] = src
	}
}

var extendedListSourcesByName = map[string]ListSource{}

func extendedSourceString(ls ListSource) (string, bool) {
	s, ok := extendedListSources[ls]
	return s, ok
}

func parseExtendedSource(s string) (ListSource, bool) {
	ls, ok := extendedListSourcesByName[s]
	return ls, ok
}
