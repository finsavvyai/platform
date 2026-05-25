package agent

// CustomerRecord represents a bank customer to screen.
type CustomerRecord struct {
	ID          string
	Name        string
	DOB         string
	Nationality string
	Type        string // "individual" or "company"
}

// MatchDetail holds details about a single match against an entity.
type MatchDetail struct {
	EntityID   string
	EntityName string
	ListID     string
	Confidence float64
}

// BatchResult holds the screening outcome for one customer.
type BatchResult struct {
	CustomerID string
	Matched    bool
	Matches    []MatchDetail
	RiskLevel  string
}
