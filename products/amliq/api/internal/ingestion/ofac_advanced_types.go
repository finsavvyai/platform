package ingestion

type advSDNEntry struct {
	UID           string                `xml:"uid"`
	SDNType       string                `xml:"sdnType"`
	FirstName     string                `xml:"firstName"`
	LastName      string                `xml:"lastName"`
	Title         string                `xml:"title"`
	Remarks       string                `xml:"remarks"`
	AKAList       []advAKA              `xml:"akaList>aka"`
	ProgramList   []advProgram          `xml:"programList>program"`
	IDList        []advID               `xml:"idList>id"`
	NationalityList []advNationality     `xml:"nationalityList>nationality"`
	CitizenshipList []advCitizenship     `xml:"citizenshipList>citizenship"`
	AddressList   []advAddress          `xml:"addressList>address"`
	DOBList       []advDateOfBirth      `xml:"dateOfBirthList>dateOfBirth"`
	POBList       []advPlaceOfBirth     `xml:"placeOfBirthList>placeOfBirth"`
	VesselInfo    *advVesselInfo        `xml:"vesselInfo"`
	Gender        string                `xml:"gender>genderCode"`
}

type advAKA struct {
	FirstName string `xml:"firstName"`
	LastName  string `xml:"lastName"`
	Type      string `xml:"type"`
}

type advProgram struct {
	ProgramID string `xml:"programID"`
}

type advID struct {
	IDType   string `xml:"idType"`
	IDNumber string `xml:"idNumber"`
	Country  string `xml:"issuanceCountry"`
}

type advNationality struct {
	Country string `xml:"country"`
}

type advCitizenship struct {
	Country string `xml:"country"`
}

type advAddress struct {
	AddressLine1 string `xml:"address1"`
	AddressLine2 string `xml:"address2"`
	City         string `xml:"city"`
	PostalCode   string `xml:"postalCode"`
	Country      string `xml:"country"`
}

type advDateOfBirth struct {
	DateOfBirth string `xml:"dateOfBirth"`
}

type advPlaceOfBirth struct {
	City    string `xml:"city"`
	Country string `xml:"country"`
}

type advVesselInfo struct {
	VesselName string `xml:"vesselName"`
	VesselType string `xml:"vesselType"`
	CallSign   string `xml:"callSign"`
	IMONumber  string `xml:"imoNumber"`
	MMSI       string `xml:"mmsi"`
	Flag       string `xml:"flag"`
}
