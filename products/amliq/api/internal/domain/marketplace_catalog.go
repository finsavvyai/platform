package domain

// MarketplaceEntry describes a sanctions list available in the marketplace.
type MarketplaceEntry struct {
	ID              string
	Name            string
	Description     string
	Region          string
	Category        string
	SourceURL       string
	ParserType      string
	EntityCount     int
	UpdateFrequency string
	LastSynced      string
	Tier            string
}

// FindMarketplaceEntry returns the entry for a given list ID.
func FindMarketplaceEntry(id string) *MarketplaceEntry {
	for _, e := range MarketplaceCatalog() {
		if e.ID == id {
			return &e
		}
	}
	return nil
}

// mp is a builder shorthand for creating a MarketplaceEntry.
func mp(
	id, name, desc, region, category, parser string,
	count int, freq string,
) MarketplaceEntry {
	return MarketplaceEntry{
		ID: id, Name: name, Description: desc,
		Region: region, Category: category, ParserType: parser,
		EntityCount: count, UpdateFrequency: freq, Tier: "free",
	}
}
