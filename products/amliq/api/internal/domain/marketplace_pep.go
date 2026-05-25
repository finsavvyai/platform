package domain

func marketplacePEP() []MarketplaceEntry {
	return []MarketplaceEntry{
		mp("everypolitician", "Every Politician",
			"Global database of politicians and public officials",
			"Global", "pep", "opensanctions", 90000, "weekly"),
		mp("cia-world-leaders", "CIA World Leaders",
			"CIA directory of heads of state and cabinet members",
			"Global", "pep", "opensanctions", 3000, "weekly"),
		mp("coe-assembly", "CoE Parliamentary Assembly",
			"Council of Europe Parliamentary Assembly members",
			"Europe", "pep", "opensanctions", 600, "weekly"),
		mp("us-legislators", "US Legislators",
			"Current and former US Congress members",
			"Americas", "pep", "opensanctions", 12000, "weekly"),
	}
}
