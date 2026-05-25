package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

var scriptRe = regexp.MustCompile(`(?s)<script>(.*?)</script>`)

// fetchJenkinsConfigXML pulls the raw config.xml from Jenkins with HTTP
// basic auth. Times out after 30 seconds.
func fetchJenkinsConfigXML(ctx context.Context, base, job, user, token string) (string, error) {
	trimmed := strings.TrimRight(base, "/")
	url := fmt.Sprintf("%s/job/%s/config.xml", trimmed, job)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return "", err
	}
	req.SetBasicAuth(user, token)
	req.Header.Set("Accept", "application/xml")
	client := &http.Client{Timeout: 30 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 400 {
		return "", fmt.Errorf("jenkins returned %d: %s", res.StatusCode, truncateStr(string(body), 200))
	}
	return string(body), nil
}

// extractJenkinsfileScript pulls the inline <script>...</script> body out
// of a pipeline job config.xml and decodes common XML entities.
// Returns empty string when the job is SCM-backed.
func extractJenkinsfileScript(xml string) string {
	m := scriptRe.FindStringSubmatch(xml)
	if len(m) < 2 {
		return ""
	}
	return decodeXMLEntities(m[1])
}

func decodeXMLEntities(s string) string {
	r := strings.NewReplacer(
		"&lt;", "<",
		"&gt;", ">",
		"&quot;", "\"",
		"&apos;", "'",
		"&amp;", "&",
	)
	return r.Replace(s)
}

func truncateStr(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
