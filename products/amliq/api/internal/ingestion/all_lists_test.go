package ingestion

import "testing"

func TestAllListConfigsNoDuplicates(t *testing.T) {
	all := AllListConfigs()
	seen := map[string]bool{}
	for _, lc := range all {
		if lc.ListID == "" || lc.SourceURL == "" {
			t.Errorf("incomplete list config: %+v", lc)
		}
		if seen[lc.ListID] {
			t.Errorf("duplicate list ID: %s", lc.ListID)
		}
		seen[lc.ListID] = true
	}
}

func TestTotalListCountMinimum(t *testing.T) {
	count := TotalListCount()
	if count < 50 {
		t.Errorf("expected ≥50 total lists, got %d", count)
	}
	t.Logf("total list count: %d", count)
}

func TestExpandedListsNotEmpty(t *testing.T) {
	lists := ExpandedLists()
	if len(lists) < 30 {
		t.Errorf("expected ≥30 expanded lists, got %d", len(lists))
	}
}

func TestOFACSecondaryListsNotEmpty(t *testing.T) {
	lists := OFACSecondaryLists()
	if len(lists) < 5 {
		t.Errorf("expected ≥5 OFAC secondary, got %d", len(lists))
	}
}

func TestCountryDirectFeedsNotEmpty(t *testing.T) {
	lists := CountryDirectFeeds()
	if len(lists) < 15 {
		t.Errorf("expected ≥15 country feeds, got %d", len(lists))
	}
}

func TestEnforcementListsNotEmpty(t *testing.T) {
	lists := EnforcementAndDebarmentLists()
	if len(lists) < 8 {
		t.Errorf("expected ≥8 enforcement lists, got %d", len(lists))
	}
}

func TestExtendedPEPSourcesNotEmpty(t *testing.T) {
	lists := ExtendedPEPSources()
	if len(lists) < 10 {
		t.Errorf("expected ≥10 PEP sources, got %d", len(lists))
	}
}

func TestCryptoSourcesExpanded(t *testing.T) {
	// Floor: 15 OFAC raw chains + OFAC SDN crypto + Ransomwhere
	// + NBCTF + Chainalysis + OpenSanctions + EU + UK OFSI
	// + Tornado Cash + Bitcoin Abuse + Elliptic = 25.
	if len(CryptoSources) < 25 {
		t.Errorf("expected ≥25 crypto sources, got %d",
			len(CryptoSources))
	}
	t.Logf("total crypto sources: %d", len(CryptoSources))
}
