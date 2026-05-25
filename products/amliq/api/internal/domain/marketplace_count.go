package domain

import "strconv"

// ListCount returns the total number of sanctions lists
// available in the marketplace catalog.
func ListCount() int {
	return len(MarketplaceCatalog())
}

// ListCountStr returns ListCount as a string for display.
func ListCountStr() string {
	return strconv.Itoa(ListCount())
}
