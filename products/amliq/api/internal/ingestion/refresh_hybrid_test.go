package ingestion

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

// Table-driven test for mergeLists: the union of the regulatory
// mandatory baseline with a tenant's EnabledLists overrides.
func TestMergeLists(t *testing.T) {
	mandatory := []domain.ListConfig{
		{ListID: "ofac-sdn", SyncEnabled: true, SyncSchedule: "0 3 * * *", Threshold: 0.7},
		{ListID: "un", SyncEnabled: true, SyncSchedule: "0 5 * * *", Threshold: 0.72},
	}

	tests := []struct {
		name    string
		tenant  []domain.ListConfig
		wantIDs map[string]struct {
			enabled   bool
			schedule  string
			threshold float64
		}
	}{
		{
			name:   "mandatory_only_no_tenant_entries",
			tenant: nil,
			wantIDs: map[string]struct {
				enabled   bool
				schedule  string
				threshold float64
			}{
				"ofac-sdn": {true, "0 3 * * *", 0.7},
				"un":       {true, "0 5 * * *", 0.72},
			},
		},
		{
			name: "mandatory_force_on_even_when_tenant_disables",
			tenant: []domain.ListConfig{
				{ListID: "ofac-sdn", SyncEnabled: false, SyncSchedule: "0 9 * * *", Threshold: 0.9},
			},
			wantIDs: map[string]struct {
				enabled   bool
				schedule  string
				threshold float64
			}{
				// SyncEnabled forced to true; schedule/threshold override kept.
				"ofac-sdn": {true, "0 9 * * *", 0.9},
				"un":       {true, "0 5 * * *", 0.72},
			},
		},
		{
			name: "discretionary_tenant_list_added_to_union",
			tenant: []domain.ListConfig{
				{ListID: "israeli_treasury", SyncEnabled: true, SyncSchedule: "0 9 * * 1", Threshold: 0.7},
			},
			wantIDs: map[string]struct {
				enabled   bool
				schedule  string
				threshold float64
			}{
				"ofac-sdn":         {true, "0 3 * * *", 0.7},
				"un":               {true, "0 5 * * *", 0.72},
				"israeli_treasury": {true, "0 9 * * 1", 0.7},
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := mergeLists(mandatory, tc.tenant)
			if len(got) != len(tc.wantIDs) {
				t.Fatalf("len=%d want=%d", len(got), len(tc.wantIDs))
			}
			for _, lc := range got {
				w, ok := tc.wantIDs[lc.ListID]
				if !ok {
					t.Fatalf("unexpected list %q in output", lc.ListID)
				}
				if lc.SyncEnabled != w.enabled {
					t.Errorf("%s: SyncEnabled=%v want=%v", lc.ListID, lc.SyncEnabled, w.enabled)
				}
				if lc.SyncSchedule != w.schedule {
					t.Errorf("%s: schedule=%q want=%q", lc.ListID, lc.SyncSchedule, w.schedule)
				}
				if lc.Threshold != w.threshold {
					t.Errorf("%s: threshold=%v want=%v", lc.ListID, lc.Threshold, w.threshold)
				}
			}
		})
	}
}
