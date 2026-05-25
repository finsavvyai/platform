package api

import "net/http"

// SubProcessor describes an external data processor.
// Per GDPR Art. 28 a controller must publish the directory; auditors
// expect a stable, machine-readable URL.
type SubProcessor struct {
	Name       string `json:"name"`
	Purpose    string `json:"purpose"`
	Location   string `json:"location"`
	DataTypes  string `json:"data_types"`
	WebsiteURL string `json:"website_url"`
}

// SubProcessors returns the published directory. Update this slice
// whenever a new external processor is added — the publication of
// this list is itself a controlled event tracked in change-management.
func SubProcessors() []SubProcessor {
	return []SubProcessor{
		{
			Name:       "LemonSqueezy",
			Purpose:    "subscription billing and tax collection",
			Location:   "United States (Stripe-backed)",
			DataTypes:  "tenant email, billing address, plan id",
			WebsiteURL: "https://www.lemonsqueezy.com/dpa",
		},
		{
			Name:       "PostgreSQL hosting",
			Purpose:    "primary application database",
			Location:   "EU-Frankfurt (planned region; pre-launch)",
			DataTypes:  "screening records, audit log, subscription state",
			WebsiteURL: "",
		},
		{
			Name:       "OpenSanctions",
			Purpose:    "PEP / sanctions list ingestion (read-only)",
			Location:   "Germany",
			DataTypes:  "no customer data shared — outbound public data only",
			WebsiteURL: "https://www.opensanctions.org/docs/data-licence/",
		},
	}
}

// HandleSubProcessors serves GET /api/v1/privacy/subprocessors as
// public JSON. No auth: the directory must be world-readable so a
// regulator (or a curious customer) can verify it without a contract.
func HandleSubProcessors(w http.ResponseWriter, _ *http.Request) {
	Success(w, map[string]any{"subprocessors": SubProcessors()},
		http.StatusOK)
}
