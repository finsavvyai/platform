package api

import (
	"context"
	"net/http/httptest"
	"testing"
)

func TestSyncListHandlerExtractParams(t *testing.T) {
	tests := []struct {
		name     string
		tenantID string
		listID   string
		wantErr  bool
	}{
		{
			name:     "valid_params",
			tenantID: "tnt_aabbccddeeff",
			listID:   "ofac",
			wantErr:  false,
		},
		{
			name:     "missing_tenant",
			tenantID: "",
			listID:   "ofac",
			wantErr:  true,
		},
		{
			name:     "missing_list",
			tenantID: "tnt_aabbccddeeff",
			listID:   "",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := &SyncListHandler{}
			r := httptest.NewRequest("POST", "/api/v1/lists/"+tt.listID+"/sync", nil)
			if tt.tenantID != "" {
				ctx := context.WithValue(r.Context(), TenantContextKey, tt.tenantID)
				r = r.WithContext(ctx)
			}
			if tt.listID != "" {
				r.SetPathValue("id", tt.listID)
			}

			_, _, err := h.extractParams(r)
			if (err != nil) != tt.wantErr {
				t.Errorf("extractParams() err=%v, wantErr=%v", err, tt.wantErr)
			}
		})
	}
}
