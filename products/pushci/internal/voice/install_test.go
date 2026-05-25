package voice

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

const validVoicesYAML = `personas:
  - name: pirate-style
    voice: Daniel
    description: Pirate-themed deploy commentary
    phrases:
      start: ["Aye, hoist the colors. Deploying."]
      pass:  ["Ye scurvy tests passed."]
`

func TestInstallFromURL_RejectsNonHTTPS(t *testing.T) {
	_, _, err := InstallFromURL(context.Background(), "http://example.com/voices.yml")
	if err == nil || !strings.Contains(err.Error(), "https://") {
		t.Fatalf("expected https-only error; got %v", err)
	}
}

func TestInstallFromURL_AddsRemotePersonas(t *testing.T) {
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(validVoicesYAML))
	}))
	defer srv.Close()
	dest := filepath.Join(t.TempDir(), "voices.yml")
	t.Setenv("PUSHCI_VOICE_FILE", dest)
	added, gotDest, err := installViaClient(t, srv, srv.URL+"/v.yml")
	if err != nil {
		t.Fatal(err)
	}
	if added != 1 {
		t.Errorf("want 1 persona added; got %d", added)
	}
	if gotDest != dest {
		t.Errorf("want dest %q; got %q", dest, gotDest)
	}
	if got := PersonaByName("pirate-style"); got.Name != "pirate-style" {
		t.Fatalf("installed persona missing from registry; got %+v", got)
	}
}

func TestInstallFromURL_NeverOverwritesExisting(t *testing.T) {
	dest := filepath.Join(t.TempDir(), "voices.yml")
	t.Setenv("PUSHCI_VOICE_FILE", dest)
	// Pre-seed a user persona named "pirate-style"; remote install
	// must NOT overwrite it.
	writeUserFile(t, `personas:
  - name: pirate-style
    voice: Karen
    phrases: {start: ["original"]}
`)
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(validVoicesYAML))
	}))
	defer srv.Close()
	added, _, err := installViaClient(t, srv, srv.URL+"/v.yml")
	if err != nil {
		t.Fatal(err)
	}
	if added != 0 {
		t.Errorf("name collision should add zero; got %d", added)
	}
	if got := PersonaByName("pirate-style"); got.VoiceID != "Karen" {
		t.Fatalf("user override clobbered: voice=%q", got.VoiceID)
	}
}

// installViaClient uses the test server's TLS-trusting client by
// pointing the production HTTP at the test server's certificate
// pool. Avoids modifying production code purely for test access.
func installViaClient(t *testing.T, srv *httptest.Server, src string) (int, string, error) {
	t.Helper()
	origClient := http.DefaultTransport
	http.DefaultTransport = srv.Client().Transport
	t.Cleanup(func() { http.DefaultTransport = origClient })
	return InstallFromURL(context.Background(), src)
}
