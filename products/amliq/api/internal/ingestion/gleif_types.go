package ingestion

// gleifResponse mirrors the GLEIF JSON:API pagination envelope.
type gleifResponse struct {
	Data []gleifRecord `json:"data"`
	Meta struct {
		Pagination struct {
			Total       int `json:"total"`
			CurrentPage int `json:"currentPage"`
			PerPage     int `json:"perPage"`
			LastPage    int `json:"lastPage"`
		} `json:"pagination"`
	} `json:"meta"`
}

// gleifAddress mirrors a GLEIF legal/HQ address block.
// addressLines is an array of street lines in the GLEIF JSON:API.
type gleifAddress struct {
	AddressLines []string `json:"addressLines"`
	City         string   `json:"city"`
	Region       string   `json:"region"`
	Country      string   `json:"country"`
	PostalCode   string   `json:"postalCode"`
}

// gleifRecord is one LEI record. Fields surfaced to screening include
// legal name, jurisdiction, status/category, HQ + legal addresses, and
// legal form — GLEIF still publishes more we don't use yet (predecessor/
// successor LEIs, parent relationships, etc.).
type gleifRecord struct {
	ID         string `json:"id"` // LEI code
	Attributes struct {
		Entity struct {
			LegalName struct {
				Name string `json:"name"`
			} `json:"legalName"`
			Jurisdiction       string       `json:"jurisdiction"`
			Category           string       `json:"category"`
			Status             string       `json:"status"`
			LegalAddress       gleifAddress `json:"legalAddress"`
			HeadquartersAddress gleifAddress `json:"headquartersAddress"`
			LegalForm struct {
				ID string `json:"id"`
			} `json:"legalForm"`
		} `json:"entity"`
		Registration struct {
			Status string `json:"status"`
		} `json:"registration"`
	} `json:"attributes"`
}

// LEIRecord is the caller-facing shape returned by GLEIFClient.
type LEIRecord struct {
	LEI                string
	LegalName          string
	Country            string
	RegistrationStatus string
}
