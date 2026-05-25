package gitlab

import (
	"net/http"
	"testing"
)

func TestHasToken(t *testing.T) {
	c := NewClient(Config{Token: ""}, newTestLogger())
	if c.HasToken() {
		t.Fatalf("empty token should report false")
	}
	c2 := NewClient(Config{Token: "glpat-x"}, newTestLogger())
	if !c2.HasToken() {
		t.Fatalf("set token should report true")
	}
}

func TestSetHTTPClient(t *testing.T) {
	c := NewClient(Config{Token: "x"}, newTestLogger())
	custom := &http.Client{}
	c.SetHTTPClient(custom)
	if c.httpClient != custom {
		t.Fatalf("SetHTTPClient did not override")
	}
}
