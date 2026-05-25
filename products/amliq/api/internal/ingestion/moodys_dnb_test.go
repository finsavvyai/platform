package ingestion

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func mockMCPServer(t *testing.T, toolName, payload string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req map[string]interface{}
		_ = json.NewDecoder(r.Body).Decode(&req)
		params := req["params"].(map[string]interface{})
		if params["name"] != toolName {
			t.Errorf("tool name = %v, want %s", params["name"], toolName)
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"jsonrpc": "2.0", "id": req["id"],
			"result": map[string]interface{}{
				"content": []interface{}{
					map[string]interface{}{"type": "text", "text": payload},
				},
			},
		})
	}))
}

func TestMoodysMCP_Screen_Hits(t *testing.T) {
	srv := mockMCPServer(t, "screen_entity", `{"matches":[
		{"entity_id":"oct-1","name":"Acme Corp","match_type":"sanction",
		 "tier":0,"country":"RU","confidence":0.92,
		 "source_url":"https://moodys/o/1","last_updated":"2026-05-01"}
	]}`)
	defer srv.Close()

	m := &MoodysMCP{client: NewMCPClient(srv.URL, "tok", nil)}
	hits, err := m.Screen(context.Background(), "Acme Corp", "company")
	if err != nil {
		t.Fatal(err)
	}
	if len(hits) != 1 {
		t.Fatalf("expected 1 hit, got %d", len(hits))
	}
	if hits[0].MatchType != "sanction" || hits[0].Country != "RU" {
		t.Errorf("unexpected hit: %+v", hits[0])
	}
}

func TestMoodysMCP_Screen_NoHits(t *testing.T) {
	srv := mockMCPServer(t, "screen_entity", `{"matches":[]}`)
	defer srv.Close()
	m := &MoodysMCP{client: NewMCPClient(srv.URL, "", nil)}
	hits, err := m.Screen(context.Background(), "John Doe", "individual")
	if err != nil {
		t.Fatal(err)
	}
	if len(hits) != 0 {
		t.Errorf("expected no hits, got %d", len(hits))
	}
}

func TestDnBMCP_LookupByDUNS(t *testing.T) {
	srv := mockMCPServer(t, "corporate_hierarchy", `{
		"duns":"01-234-5678","legal_name":"GlobalCo Plc","country":"GB",
		"parent_duns":"99-999-9999",
		"ubos":[{"name":"Jane Doe","ownership_percent":35.0,"country":"GB"}],
		"children":[{"duns":"02-111-1111","name":"GlobalCo US Inc","country":"US"}]
	}`)
	defer srv.Close()

	d := &DnBMCP{client: NewMCPClient(srv.URL, "tok", nil)}
	h, err := d.LookupByDUNS(context.Background(), "01-234-5678")
	if err != nil {
		t.Fatal(err)
	}
	if h == nil {
		t.Fatal("expected hierarchy, got nil")
	}
	if h.LegalName != "GlobalCo Plc" || h.ParentDUNS != "99-999-9999" {
		t.Errorf("unexpected hierarchy: %+v", h)
	}
	if len(h.UBOs) != 1 || h.UBOs[0].OwnershipPercent != 35.0 {
		t.Errorf("UBOs not parsed: %+v", h.UBOs)
	}
}

func TestNewMoodysMCPFromEnv_NoURL(t *testing.T) {
	t.Setenv("MOODYS_MCP_URL", "")
	if NewMoodysMCPFromEnv() != nil {
		t.Error("expected nil when MOODYS_MCP_URL unset")
	}
}

func TestNewDnBMCPFromEnv_NoURL(t *testing.T) {
	t.Setenv("DNB_MCP_URL", "")
	if NewDnBMCPFromEnv() != nil {
		t.Error("expected nil when DNB_MCP_URL unset")
	}
}
