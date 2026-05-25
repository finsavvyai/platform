package jenkins

import (
	"net/http"
	"testing"
)

func TestSetHTTPClient(t *testing.T) {
	c := NewClient(Config{Username: "u", APIToken: "t", BaseURL: "https://j"}, newTestLogger())
	custom := &http.Client{}
	c.SetHTTPClient(custom)
	if c.httpClient != custom {
		t.Fatal("SetHTTPClient did not override")
	}
}
