package domain

// MarketplaceCatalog returns all available sanctions lists.
func MarketplaceCatalog() []MarketplaceEntry {
	var all []MarketplaceEntry
	all = append(all, marketplaceGlobal()...)
	all = append(all, marketplaceRegional()...)
	all = append(all, marketplaceBulk()...)
	all = append(all, marketplacePEP()...)
	return all
}

func marketplaceGlobal() []MarketplaceEntry {
	return []MarketplaceEntry{
		mp("ofac-sdn", "OFAC SDN", "US Treasury Specially Designated Nationals",
			"Global", "sanctions", "ofac", 12000, "daily"),
		mp("ofac-consolidated", "OFAC Consolidated",
			"US Treasury consolidated non-SDN dataset",
			"Global", "sanctions", "opensanctions", 15000, "daily"),
		mp("un-consolidated", "UN Consolidated Sanctions",
			"United Nations Security Council consolidated list",
			"Global", "sanctions", "un", 1000, "daily"),
		mp("eu-sanctions", "EU Financial Sanctions",
			"European Commission consolidated financial sanctions",
			"Europe", "sanctions", "eu", 5900, "daily"),
		mp("eeas-consolidated", "EEAS Consolidated",
			"EU External Action Service consolidated list",
			"Europe", "sanctions", "opensanctions", 3500, "daily"),
		mp("gb-fcdo", "UK FCDO Sanctions",
			"UK Foreign, Commonwealth & Development Office sanctions",
			"Europe", "sanctions", "opensanctions", 3800, "daily"),
		mp("interpol-red", "Interpol Red Notices",
			"Interpol international wanted persons",
			"Global", "law_enforcement", "interpol", 6500, "daily"),
	}
}
