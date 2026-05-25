package ingestion

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestExternalEnricher_BothSources(t *testing.T) {
	moodys := mockMCPServer(t, "screen_entity",
		`{"matches":[{"entity_id":"m1","name":"Acme","match_type":"sanction","confidence":0.91}]}`)
	defer moodys.Close()
	dnb := mockMCPServer(t, "corporate_hierarchy",
		`{"duns":"01","legal_name":"Acme Plc","country":"GB"}`)
	defer dnb.Close()

	e := &ExternalEnricher{
		moodys: &MoodysMCP{client: NewMCPClient(moodys.URL, "", nil)},
		dnb:    &DnBMCP{client: NewMCPClient(dnb.URL, "", nil)},
	}

	res := e.EnrichEntity(context.Background(), EnricherInput{
		Name: "Acme", EntityType: "company", DUNS: "01",
	})
	if len(res.MoodysMatches) != 1 || res.MoodysMatches[0].EntityID != "m1" {
		t.Errorf("Moody's not propagated: %+v", res.MoodysMatches)
	}
	if res.DnBHierarchy == nil || res.DnBHierarchy.LegalName != "Acme Plc" {
		t.Errorf("D&B not propagated: %+v", res.DnBHierarchy)
	}
	if len(res.Errors) != 0 {
		t.Errorf("unexpected errors: %v", res.Errors)
	}
}

func TestExternalEnricher_OneSourceFails_OtherStillRuns(t *testing.T) {
	moodys := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "boom", http.StatusBadGateway)
	}))
	defer moodys.Close()
	dnb := mockMCPServer(t, "corporate_hierarchy",
		`{"duns":"01","legal_name":"Acme Plc"}`)
	defer dnb.Close()

	e := &ExternalEnricher{
		moodys: &MoodysMCP{client: NewMCPClient(moodys.URL, "", nil)},
		dnb:    &DnBMCP{client: NewMCPClient(dnb.URL, "", nil)},
	}
	res := e.EnrichEntity(context.Background(), EnricherInput{
		Name: "Acme", EntityType: "company", DUNS: "01",
	})

	if res.Errors["moodys"] == nil {
		t.Error("expected Moody's error to be recorded")
	}
	if res.DnBHierarchy == nil {
		t.Error("D&B half should still succeed when Moody's fails")
	}
}

func TestExternalEnricher_NoDUNS_SkipsDnB(t *testing.T) {
	called := false
	dnb := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"jsonrpc": "2.0", "id": 1, "result": map[string]interface{}{"content": []interface{}{}}})
	}))
	defer dnb.Close()

	e := &ExternalEnricher{
		dnb: &DnBMCP{client: NewMCPClient(dnb.URL, "", nil)},
	}
	_ = e.EnrichEntity(context.Background(), EnricherInput{
		Name: "x", EntityType: "individual", DUNS: "",
	})
	if called {
		t.Error("D&B should not be hit when DUNS is empty")
	}
}

func TestExternalEnricher_NotConfigured_NoOp(t *testing.T) {
	e := &ExternalEnricher{}
	if e.IsConfigured() {
		t.Error("empty enricher should not report as configured")
	}
	res := e.EnrichEntity(context.Background(), EnricherInput{Name: "x"})
	if len(res.MoodysMatches) != 0 || res.DnBHierarchy != nil {
		t.Error("no-op enricher returned data")
	}
}

func TestNewExternalEnricherFromEnv_AllUnset(t *testing.T) {
	t.Setenv("MOODYS_MCP_URL", "")
	t.Setenv("DNB_MCP_URL", "")
	e := NewExternalEnricherFromEnv()
	if e.IsConfigured() {
		t.Error("env-empty constructor should not be configured")
	}
}
