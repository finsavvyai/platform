package domain

func marketplaceBulk() []MarketplaceEntry {
	return []MarketplaceEntry{
		mp("os-crime", "Crime & Enforcement",
			"Global crime and law enforcement watchlists",
			"Global", "law_enforcement", "opensanctions", 247000, "daily"),
		mp("os-debarment", "Debarment Lists",
			"Global procurement debarment and exclusion lists",
			"Global", "regulatory", "opensanctions", 210000, "daily"),
		mp("os-regulatory", "Regulatory Actions",
			"Global financial regulatory enforcement actions",
			"Global", "regulatory", "opensanctions", 160000, "daily"),
		mp("os-sanctions", "Consolidated Sanctions",
			"OpenSanctions consolidated global sanctions",
			"Global", "sanctions", "opensanctions", 50000, "daily"),
		mp("os-wanted", "Wanted Persons",
			"Global wanted persons from law enforcement agencies",
			"Global", "law_enforcement", "opensanctions", 30000, "daily"),
		mp("os-special-interest", "Special Interest Persons",
			"Global special interest and high-risk entities",
			"Global", "sanctions", "opensanctions", 25000, "daily"),
		mp("os-maritime", "Maritime Sanctions",
			"Sanctioned vessels, ship owners, and maritime entities",
			"Global", "sanctions", "opensanctions", 8000, "daily"),

		// Ukraine-specific
		mp("ua-nsdc", "Ukraine NSDC Sanctions",
			"Ukraine NSDC sanctions against Russian entities",
			"Europe", "sanctions", "opensanctions", 15000, "daily"),

		// Poland
		mp("pl-wanted", "Poland Wanted",
			"Polish law enforcement wanted persons list",
			"Europe", "law_enforcement", "opensanctions", 30000, "daily"),

		// France
		mp("fr-maires", "France Mayors",
			"Directory of French municipal mayors",
			"Europe", "pep", "opensanctions", 35000, "weekly"),
	}
}
