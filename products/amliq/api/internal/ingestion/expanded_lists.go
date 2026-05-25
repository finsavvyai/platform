package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// ExpandedLists returns configs for ALL lists beyond the core 9.
// Includes OFAC secondary, country direct feeds, enforcement,
// debarment, extended PEP, and corporate registries.
func ExpandedLists() []domain.ListConfig {
	var all []domain.ListConfig
	all = append(all, OFACSecondaryLists()...)
	all = append(all, CountryDirectFeeds()...)
	all = append(all, EnforcementAndDebarmentLists()...)
	all = append(all, ExtendedPEPSources()...)
	all = append(all, IsraeliPropertyLists()...)
	all = append(all, CorporateRegistryLists()...)
	all = append(all, RegulatoryActionLists()...)
	return all
}

// AllListConfigs returns all original + expanded list configurations.
func AllListConfigs() []domain.ListConfig {
	return append(AllMajorLists(), ExpandedLists()...)
}

// TotalListCount returns the number of supported sanctions lists.
func TotalListCount() int {
	return len(AllListConfigs())
}
