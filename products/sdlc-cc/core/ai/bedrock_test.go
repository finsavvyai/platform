package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestBedrockClient_Complete(t *testing.T) {
	tests := []struct {
		name       string
		respCode   int
		respBody   string
		wantSubstr string
		wantErr    bool
	}{
		{"ok", 200,
			`{"content":[{"type":"text","text":"sanctioned"}]}`,
			"sanctioned", false},
		{"empty content", 200, `{"content":[]}`, "", true},
		{"5xx", 503, `{"message":"throttled"}`, "", true},
		{"bad json", 200, `not-json`, "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(
				func(w http.ResponseWriter, r *http.Request) {
					if r.Header.Get("Authorization") == "" {
						t.Fatal("Authorization header missing — SigV4 not applied")
					}
					w.WriteHeader(tt.respCode)
					_, _ = w.Write([]byte(tt.respBody))
				}))
			defer srv.Close()

			c := &BedrockClient{
				region:  "us-east-1",
				model:   "anthropic.claude-haiku",
				baseURL: srv.URL,
				hc:      srv.Client(),
				signer: &sigV4Signer{
					accessKey: "AKIATEST", secretKey: "secret",
					region: "us-east-1", service: "bedrock",
				},
				now: func() time.Time {
					return time.Date(2026, 5, 3, 12, 0, 0, 0, time.UTC)
				},
			}
			got, err := c.Complete(context.Background(), "Screen Smith")
			if (err != nil) != tt.wantErr {
				t.Fatalf("err=%v wantErr=%v", err, tt.wantErr)
			}
			if !tt.wantErr && got != tt.wantSubstr {
				t.Errorf("got %q want %q", got, tt.wantSubstr)
			}
		})
	}
}

func TestBedrockClient_IsConfigured(t *testing.T) {
	if (*BedrockClient)(nil).IsConfigured() {
		t.Error("nil receiver must report unconfigured")
	}
	c := &BedrockClient{
		region: "us-east-1",
		signer: &sigV4Signer{accessKey: "k", secretKey: "s"},
	}
	if !c.IsConfigured() {
		t.Error("configured client reported unconfigured")
	}
}

// TestBedrockClient_RequestShape locks in the JSON body the gateway
// sends — protection against an accidental schema bump.
func TestBedrockClient_RequestShape(t *testing.T) {
	var captured map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			_ = json.NewDecoder(r.Body).Decode(&captured)
			_, _ = w.Write([]byte(`{"content":[{"type":"text","text":"x"}]}`))
		}))
	defer srv.Close()
	c := &BedrockClient{
		region: "us-east-1", model: "m", baseURL: srv.URL, hc: srv.Client(),
		signer: &sigV4Signer{accessKey: "k", secretKey: "s",
			region: "us-east-1", service: "bedrock"},
		now: time.Now,
	}
	_, _ = c.Complete(context.Background(), "hello")
	if captured["anthropic_version"] != "bedrock-2023-05-31" {
		t.Errorf("anthropic_version drift: got %v", captured["anthropic_version"])
	}
}
