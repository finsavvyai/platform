package ingestion

// NBCTF direct download URLs from Israeli Treasury/MoD.
const (
	// CSV downloads — primary
	NBCTFOrgsURL        = "https://nbctf.mod.gov.il/he/Announcements/Documents/NBCTFIsrael%20-%20Terror%20Organization%20Designation%20List_CSV.csv"
	NBCTFIndividualsURL = "https://nbctf.mod.gov.il/he/Announcements/Documents/NBCTF%20Israel%20designation%20Individuals_CSV.csv"

	// XML downloads — fallback (same data, different format)
	NBCTFOrgsXML        = "https://nbctf.mod.gov.il/he/Announcements/Documents/NBCTFIsrael%20-%20Terror%20Organization%20Designation%20List_XML.xml"
	NBCTFIndividualsXML = "https://nbctf.mod.gov.il/he/Announcements/Documents/NBCTF%20Israel%20designation%20Individuals_XML.xml"

	// Property seizure pages (ASPX — require HTML parsing)
	NBCTFPropertyURL = "https://nbctf.mod.gov.il/he/" +
		"MinisterSanctions/PropertyPerceptions/Pages/default.aspx"
	NBCTFRealEstateURL = "https://nbctf.mod.gov.il/he/" +
		"MinisterSanctions/PropertyPerceptions/Pages/RealEstate.aspx"
	NBCTFVehiclesURL = "https://nbctf.mod.gov.il/he/" +
		"MinisterSanctions/PropertyPerceptions/Pages/Vehicles.aspx"
	NBCTFBankAccountsURL = "https://nbctf.mod.gov.il/he/" +
		"MinisterSanctions/PropertyPerceptions/Pages/BankAccounts.aspx"
	NBCTFCompaniesURL = "https://nbctf.mod.gov.il/he/" +
		"MinisterSanctions/PropertyPerceptions/Pages/Companies.aspx"

	// Israel MoD Defense Export Control
	IsraeliMoDURL = "https://nbctf.mod.gov.il/he/Sanctions/Lists"
)
