package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aegis-aml/aegis/internal/marketing"
)

func TestHandleMarketingClaimsReturnsCanonical(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/marketing/claims", nil)
	rr := httptest.NewRecorder()
	handleMarketingClaims(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status=%d", rr.Code)
	}
	if rr.Header().Get("Cache-Control") == "" {
		t.Error("Cache-Control header missing")
	}
	var resp struct {
		Data marketing.Claims `json:"data"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	want := marketing.Canonical()
	if resp.Data.ProductName != want.ProductName {
		t.Errorf("product_name=%q, want %q", resp.Data.ProductName, want.ProductName)
	}
	if resp.Data.ListCount != want.ListCount {
		t.Errorf("list_count=%d, want %d", resp.Data.ListCount, want.ListCount)
	}
	if resp.Data.UpgradeURL != want.UpgradeURL {
		t.Errorf("upgrade_url=%q, want %q", resp.Data.UpgradeURL, want.UpgradeURL)
	}
}
