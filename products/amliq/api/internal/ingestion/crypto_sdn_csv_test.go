package ingestion

import "testing"

func TestParseSDNCryptoExtractsAllChains(t *testing.T) {
	// Real shape pulled from sdn.csv 2026-04-29 (Lazarus row).
	body := []byte(
		`27307,"LAZARUS GROUP",-0- ,"DPRK3",-0- ,-0- ,-0- ,-0- ,-0- ,` +
			`-0- ,-0- ,"Digital Currency Address - ETH ` +
			`0x098B716B8Aaf21512996dC57EB0615e2383E2f96; alt. Digital ` +
			`Currency Address - XBT 1FvPXjfPB6X3pFb9LpvCRtpBwL5ZBQQiMS; ` +
			`alt. Digital Currency Address - USDT TGW3PzkTjkyKxLnG7BftcyhArEtuTrm6Yp"`)
	src := CryptoSource{ID: "ofac-sdn-crypto", Name: "test"}
	out := parseSDNCrypto(body, src)
	if len(out) != 3 {
		t.Fatalf("want 3 entries, got %d: %+v", len(out), out)
	}
	chains := map[string]bool{}
	for _, e := range out {
		chains[e.Chain] = true
		if e.ListID != src.ID {
			t.Errorf("ListID mismatch: %s", e.ListID)
		}
	}
	for _, c := range []string{"ETH", "XBT", "USDT"} {
		if !chains[c] {
			t.Errorf("missing chain: %s", c)
		}
	}
}

func TestParseSDNCryptoDedupes(t *testing.T) {
	body := []byte(
		`Digital Currency Address - ETH 0xAAAAAAAAAAAAAAAAAAAA; ` +
			`Digital Currency Address - ETH 0xAAAAAAAAAAAAAAAAAAAA;`)
	out := parseSDNCrypto(body, CryptoSource{})
	if len(out) != 1 {
		t.Fatalf("want 1 (deduped), got %d", len(out))
	}
}

func TestParseSDNCryptoEmpty(t *testing.T) {
	out := parseSDNCrypto([]byte("no crypto here"), CryptoSource{})
	if len(out) != 0 {
		t.Fatalf("want 0, got %d", len(out))
	}
}
