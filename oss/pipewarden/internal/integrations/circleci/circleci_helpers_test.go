package circleci

import (
	"net/http"
	"testing"
)

func TestSetHTTPClient(t *testing.T) {
	c := NewClient(Config{Token: "tok"}, newTestLogger())
	custom := &http.Client{}
	c.SetHTTPClient(custom)
	if c.httpClient != custom {
		t.Fatal("override failed")
	}
}
