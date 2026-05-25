package ingestion

// euEntityAgg collects multi-row EU CSV data for a single entity.
// Multiple rows describe different aspects (names, addresses, IDs)
// of the same entity, keyed by Entity_logical_id.
type euEntityAgg struct {
	entityID string

	wholeNames  []string
	firstNames  []string
	middleNames []string
	lastNames   []string

	addresses      []string
	programs       []string
	nationalities  []string
	identifiers    []string
	additionalInfo []string
	subjectTypes   []string

	birthDate    string
	birthPlace   string
	birthCountry string

	listURL           string
	refNum            string
	pubDate           string
	dateFile          string
	regulationNumber  string
	listingDate       string
	identifierType    string
	identifierCountry string

	// Per-person rich attributes from EU FSF Naal_* columns —
	// useful for downstream filtering and display.
	gender   string
	title    string
	function string
	language string
	remark   string
}

// addRow extracts fields from one CSV row into this aggregate.
func (a *euEntityAgg) addRow(row []string, hdr headerIndex) {
	addUnique(&a.wholeNames, NormalizeName(hdr.get(row, "Naal_wholename")))
	addUnique(&a.firstNames, norm(hdr.get(row, "Naal_firstname")))
	addUnique(&a.middleNames, norm(hdr.get(row, "Naal_middlename")))
	addUnique(&a.lastNames, norm(hdr.get(row, "Naal_lastname")))

	addUnique(&a.programs, norm(hdr.get(row, "Programme")))
	addUnique(&a.programs, norm(hdr.get(row, "Naal_programme")))
	addUnique(&a.subjectTypes, norm(hdr.get(row, "Subject_type")))

	a.addAddress(row, hdr)
	addUnique(&a.additionalInfo, norm(hdr.get(row, "Addr_other")))

	a.birthDate = pickFirst(a.birthDate, norm(hdr.get(row, "Birt_date")))
	a.birthPlace = pickFirst(a.birthPlace, norm(hdr.get(row, "Birt_place")))
	a.birthCountry = pickFirst(a.birthCountry, norm(hdr.get(row, "Birt_country")))

	addUnique(&a.nationalities, norm(hdr.get(row, "Birt_country")))
	addUnique(&a.nationalities, norm(hdr.get(row, "Citi_country")))

	a.addIdentifier(row, hdr)

	a.pubDate = minDateStr(a.pubDate, norm(hdr.get(row, "Leba_publication_date")))
	a.listURL = pickFirst(a.listURL, norm(hdr.get(row, "Leba_url")))
	a.refNum = pickFirst(a.refNum, norm(hdr.get(row, "EU_ref_num")))
	a.dateFile = pickFirst(a.dateFile, norm(hdr.get(row, "Date_file")))

	// Naal_* per-person attributes — previously dropped.
	a.gender = pickFirst(a.gender, norm(hdr.get(row, "Naal_gender")))
	a.title = pickFirst(a.title, norm(hdr.get(row, "Naal_title")))
	a.function = pickFirst(a.function, norm(hdr.get(row, "Naal_function")))
	a.language = pickFirst(a.language, norm(hdr.get(row, "Naal_language")))
	a.remark = pickFirst(a.remark, norm(hdr.get(row, "Entity_remark")))
}

func (a *euEntityAgg) addAddress(row []string, hdr headerIndex) {
	parts := []string{
		norm(hdr.get(row, "Addr_number")),
		norm(hdr.get(row, "Addr_street")),
		norm(hdr.get(row, "Addr_zipcode")),
		norm(hdr.get(row, "Addr_city")),
		norm(hdr.get(row, "Addr_country")),
	}
	addr := joinNonEmpty(parts...)
	addUnique(&a.addresses, addr)
}

func (a *euEntityAgg) addIdentifier(row []string, hdr headerIndex) {
	idNum := norm(hdr.get(row, "Iden_number"))
	if idNum == "" {
		return
	}
	idCountry := norm(hdr.get(row, "Iden_country"))
	if idCountry != "" {
		idNum = idNum + " (" + idCountry + ")"
	}
	addUnique(&a.identifiers, idNum)
}
