package domain

// CryptoEntry holds info about a sanctioned wallet address.
type CryptoEntry struct {
	Address  string `json:"address"`
	Chain    string `json:"chain"`
	EntityID string `json:"entity_id"`
	ListID   string `json:"list_id"`
	Source   string `json:"source"`
}
