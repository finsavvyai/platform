package domain

func marketplaceRegional() []MarketplaceEntry {
	return []MarketplaceEntry{
		// Europe
		mp("ch-seco", "Swiss SECO Sanctions",
			"Swiss State Secretariat for Economic Affairs sanctions",
			"Europe", "sanctions", "opensanctions", 4600, "daily"),
		mp("ua-sfms", "Ukraine SDFM Blacklist",
			"Ukraine State Financial Monitoring Service blacklist",
			"Europe", "sanctions", "opensanctions", 1200, "daily"),
		mp("nl-terrorism", "Netherlands Terrorism List",
			"Netherlands national terrorism sanction list",
			"Europe", "sanctions", "opensanctions", 300, "daily"),
		mp("gb-disqualified", "UK Disqualified Directors",
			"UK Companies House disqualified directors",
			"Europe", "regulatory", "opensanctions", 8000, "daily"),
		mp("eu-os-sanctions", "EU OpenSanctions",
			"EU sanctions via OpenSanctions aggregation",
			"Europe", "sanctions", "opensanctions", 6000, "daily"),

		// Americas
		mp("us-bis-denied", "US Denied Persons List",
			"US Bureau of Industry and Security denied persons",
			"Americas", "sanctions", "opensanctions", 430, "daily"),
		mp("us-sam-exclusions", "US SAM Exclusions",
			"US System for Award Management exclusion list",
			"Americas", "regulatory", "opensanctions", 80000, "daily"),
		mp("us-hhs-exclusions", "US HHS Exclusions",
			"US Health and Human Services exclusion list",
			"Americas", "regulatory", "opensanctions", 75000, "daily"),
		mp("us-trade-csl", "US Trade CSL",
			"US Consolidated Screening List for trade compliance",
			"Americas", "sanctions", "opensanctions", 20000, "daily"),
		mp("us-sanctions", "US Sanctions Combined",
			"US combined sanctions programs",
			"Americas", "sanctions", "opensanctions", 25000, "daily"),
		mp("us-finra", "US FINRA Actions",
			"US FINRA disciplinary actions",
			"Americas", "regulatory", "opensanctions", 12000, "daily"),
		mp("us-ca-medicaid", "US CA Medicaid Exclusions",
			"California Medicaid provider exclusions",
			"Americas", "regulatory", "opensanctions", 15000, "daily"),
		mp("us-tx-medicaid", "US TX Medicaid Exclusions",
			"Texas Medicaid provider exclusions",
			"Americas", "regulatory", "opensanctions", 8000, "daily"),
		mp("br-ceis", "Brazil CEIS Debarred",
			"Brazil debarred companies and individuals",
			"Americas", "regulatory", "opensanctions", 10000, "daily"),
		mp("co-pep", "Colombia PEP",
			"Colombia politically exposed persons",
			"Americas", "pep", "opensanctions", 15000, "weekly"),

		// Middle East
		mp("il-mod-terrorists", "Israeli MoD Terror List",
			"Israeli Ministry of Defence designated terrorist orgs",
			"Middle East", "sanctions", "opensanctions", 500, "daily"),
		mp("il-nbctf", "NBCTF Seizure List",
			"Israel NBCTF terror financing seizure orders",
			"Middle East", "sanctions", "nbctf", 300, "daily"),
		mp("il-declared", "Declared Sanction List",
			"Israel declared elements sanctions list",
			"Middle East", "sanctions", "declared", 200, "weekly"),

		// Asia-Pacific
		mp("in-nse-debarred", "India NSE Debarred",
			"India National Stock Exchange debarred entities",
			"Asia-Pacific", "regulatory", "opensanctions", 8000, "daily"),
		mp("sg-gov-dir", "Singapore Gov Directory",
			"Singapore government officials directory",
			"Asia-Pacific", "pep", "opensanctions", 5000, "weekly"),

		// Africa
		mp("ng-peps", "Nigeria PEPs",
			"Nigeria politically exposed persons",
			"Africa", "pep", "opensanctions", 20000, "weekly"),
	}
}
