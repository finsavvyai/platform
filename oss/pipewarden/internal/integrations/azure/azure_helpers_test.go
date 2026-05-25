package azure

import (
	"net/http"
	"testing"
)

func TestSetHTTPClient(t *testing.T) {
	c := NewClient(Config{Token: "tok", Organization: "org"}, newTestLogger())
	custom := &http.Client{}
	c.SetHTTPClient(custom)
	if c.httpClient != custom {
		t.Fatal("override failed")
	}
}

func TestBaseURLFallbacks(t *testing.T) {
	c := NewClient(Config{Token: "tok", Organization: "myorg"}, newTestLogger())
	got := c.baseURL()
	if got == "" {
		t.Fatal("baseURL empty")
	}
}
