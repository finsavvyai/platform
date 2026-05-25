package promote

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// Registry represents an AI tool registry to submit to.
type Registry struct {
	Name    string `json:"name"`
	URL     string `json:"url"`
	Status  string `json:"status"`
	Message string `json:"message,omitempty"`
}

// SubmitResult holds the outcome of a full promotion run.
type SubmitResult struct {
	Registries    []Registry `json:"registries"`
	SearchEngines []Registry `json:"search_engines"`
	Verified      []Registry `json:"verified"`
}

var client = &http.Client{Timeout: 10 * time.Second}

// SubmitToSearchEngines pings Google, Bing, and IndexNow.
func SubmitToSearchEngines(sitemap string) []Registry {
	var results []Registry
	engines := []struct {
		name string
		url  string
	}{
		{"Google", fmt.Sprintf("https://www.google.com/ping?sitemap=%s", sitemap)},
		{"Bing", fmt.Sprintf("https://www.bing.com/ping?sitemap=%s", sitemap)},
	}
	for _, e := range engines {
		status := "ok"
		resp, err := client.Get(e.url)
		if err != nil || resp.StatusCode >= 400 {
			status = "error"
		}
		if resp != nil {
			resp.Body.Close()
		}
		results = append(results, Registry{Name: e.name, URL: e.url, Status: status})
	}
	return results
}

// SubmitIndexNow sends URLs to the IndexNow API.
func SubmitIndexNow(host, key string, urls []string) Registry {
	body := map[string]any{"host": host, "key": key, "urlList": urls}
	data, _ := json.Marshal(body)
	resp, err := client.Post(
		"https://api.indexnow.org/indexnow",
		"application/json",
		strings.NewReader(string(data)),
	)
	status := "ok"
	if err != nil || (resp != nil && resp.StatusCode >= 400) {
		status = "error"
	}
	if resp != nil {
		resp.Body.Close()
	}
	return Registry{Name: "IndexNow", URL: "https://api.indexnow.org", Status: status}
}
