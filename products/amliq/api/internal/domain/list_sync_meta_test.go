package domain

import (
	"testing"
)

func TestNewListSyncMeta(t *testing.T) {
	tests := []struct {
		name     string
		tenantID string
		listID   string
		wantErr  bool
	}{
		{
			name:     "valid",
			tenantID: "tnt_syncmeta0001",
			listID:   "ofac_sdn",
			wantErr:  false,
		},
		{
			name:     "empty_tenant",
			tenantID: "",
			listID:   "ofac_sdn",
			wantErr:  true,
		},
		{
			name:     "empty_list",
			tenantID: "tnt_syncmeta0002",
			listID:   "",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var tid TenantID
			var err error
			if tt.tenantID != "" {
				tid, err = NewTenantID(tt.tenantID)
				if err != nil {
					t.Fatalf("NewTenantID: %v", err)
				}
			}
			_, err = NewListSyncMeta(tid, tt.listID)
			if (err != nil) != tt.wantErr {
				t.Errorf("NewListSyncMeta() err=%v, wantErr=%v", err, tt.wantErr)
			}
		})
	}
}

func TestListSyncMetaValidate(t *testing.T) {
	tests := []struct {
		name    string
		meta    ListSyncMeta
		wantErr bool
	}{
		{
			name:    "negative_entity_count",
			meta:    ListSyncMeta{ListID: "ofac", EntityCount: -1},
			wantErr: true,
		},
		{
			name:    "missing_listid",
			meta:    ListSyncMeta{EntityCount: 0},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.meta.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() err=%v, wantErr=%v", err, tt.wantErr)
			}
		})
	}
}
