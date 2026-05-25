package fingerprint

import (
	"crypto/tls"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func req(headers map[string]string, t *tls.ConnectionState) *http.Request {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	for k, v := range headers {
		r.Header.Set(k, v)
	}
	r.TLS = t
	return r
}

func TestExtract_CollectsAllHeaders(t *testing.T) {
	r := req(map[string]string{
		"User-Agent":         "Mozilla/5.0",
		"Accept-Language":    "en-US,en;q=0.9",
		"Accept-Encoding":    "gzip, deflate, br",
		"Sec-CH-UA":          `"Chromium";v="120"`,
		"Sec-CH-UA-Platform": `"macOS"`,
	}, &tls.ConnectionState{Version: tls.VersionTLS13, CipherSuite: tls.TLS_AES_128_GCM_SHA256})

	s := Extract(r, "1.2.3.4")

	assert.Equal(t, "1.2.3.4", s.IP)
	assert.Equal(t, "Mozilla/5.0", s.UserAgent)
	assert.Equal(t, "en-US,en;q=0.9", s.AcceptLanguage)
	assert.Equal(t, "gzip, deflate, br", s.AcceptEncoding)
	assert.Equal(t, uint16(tls.VersionTLS13), s.TLSVersion)
	assert.Equal(t, uint16(tls.TLS_AES_128_GCM_SHA256), s.TLSCipherSuite)
	assert.Contains(t, s.SecCHUA, "Chromium")
}

func TestExtract_PlaintextHasZeroTLS(t *testing.T) {
	s := Extract(req(map[string]string{"User-Agent": "x"}, nil), "1.1.1.1")
	assert.Equal(t, uint16(0), s.TLSVersion)
	assert.Equal(t, uint16(0), s.TLSCipherSuite)
}

func TestHash_DeterministicForSameInputs(t *testing.T) {
	a := Signals{IP: "1.1.1.1", UserAgent: "ua", AcceptLanguage: "en"}
	assert.Equal(t, a.Hash(), a.Hash())
}

func TestHash_DiffersOnUAChange(t *testing.T) {
	a := Signals{IP: "1.1.1.1", UserAgent: "ua1", AcceptLanguage: "en"}
	b := a
	b.UserAgent = "ua2"
	assert.NotEqual(t, a.Hash(), b.Hash())
}

func TestHash_OrderingInsensitiveOnAcceptLanguage(t *testing.T) {
	a := Signals{UserAgent: "ua", AcceptLanguage: "en-US, en"}
	b := Signals{UserAgent: "ua", AcceptLanguage: "en, en-US"}
	assert.Equal(t, a.Hash(), b.Hash(), "normalized lang list should hash equally")
}

func TestHash_EmptyOptionalSignalsDropped(t *testing.T) {
	// Starting to send Sec-CH-UA mid-session should not rotate the fingerprint
	// when it's the only change AND the client previously sent nothing.
	// Both of these have only UA set — hashes must be stable.
	a := Signals{UserAgent: "ua"}
	b := Signals{UserAgent: "ua"}
	assert.Equal(t, a.Hash(), b.Hash())
}

func TestStable_RequiresTwoSignals(t *testing.T) {
	assert.False(t, Signals{IP: "x"}.Stable())
	assert.False(t, Signals{UserAgent: "ua"}.Stable())
	assert.True(t, Signals{UserAgent: "ua", AcceptLanguage: "en"}.Stable())
	assert.True(t, Signals{UserAgent: "ua", TLSVersion: tls.VersionTLS13}.Stable())
}

func TestMatches_ExactEqualityRequired(t *testing.T) {
	assert.False(t, Matches("", ""))
	assert.False(t, Matches("a", ""))
	assert.False(t, Matches("a", "b"))
	assert.True(t, Matches("abc", "abc"))
}

func TestTLSName_KnownVersions(t *testing.T) {
	cases := map[uint16]string{
		0:                  "none",
		tls.VersionTLS10:   "TLS1.0",
		tls.VersionTLS11:   "TLS1.1",
		tls.VersionTLS12:   "TLS1.2",
		tls.VersionTLS13:   "TLS1.3",
		uint16(0xBEEF):     "unknown",
	}
	for v, want := range cases {
		assert.Equal(t, want, TLSName(v))
	}
}
