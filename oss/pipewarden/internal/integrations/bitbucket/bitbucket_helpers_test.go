package bitbucket

import (
	"net/http"
	"testing"
)

func TestSetHTTPClient(t *testing.T) {
	c := NewClient(Config{Username: "u", AppPassword: "p"}, newTestLogger())
	custom := &http.Client{}
	c.SetHTTPClient(custom)
	if c.httpClient != custom {
		t.Fatal("override failed")
	}
}
