package analysis

import (
	"net/url"
	"regexp"
	"sort"
	"strings"
)

// EgressTarget is a single hostname (or IP) the CI runner contacted during
// a pipeline run, plus the count of distinct log lines that referenced it.
// Counts let downstream consumers rank by traffic volume without needing
// to re-parse the logs.
type EgressTarget struct {
	Host  string `json:"host"`
	Count int    `json:"count"`
}

// urlPattern matches absolute http/https URLs that appear in shell command
// output (curl, wget, npm install registry pulls, docker pull URIs, etc).
// Intentionally permissive on path/query — only the host is kept.
var urlPattern = regexp.MustCompile(`https?://([A-Za-z0-9._\-]+)(?::\d+)?(?:/[^\s'"\x60]*)?`)

// shellHostPattern catches `--host foo.bar.com` / `-H foo.bar.com` / `Host:`
// header lines that don't include a scheme.
var shellHostPattern = regexp.MustCompile(`(?i)(?:--?host(?:name)?[ =]|host:[ ]+)([A-Za-z0-9._\-]+\.[A-Za-z]{2,})`)

// ExtractEgressTargets scans pipeline run logs and returns the deduplicated
// list of external hostnames the runner contacted. Hosts are sorted by
// frequency descending then alphabetically to keep output stable across
// equivalent runs (helps downstream diff vs baseline).
//
// Localhost, private RFC1918 IPs, and the reserved CI provider domains
// (github.com workflows API, gitlab.com etc) are filtered out by default
// because they're inherent to the runner's normal operation. Use the
// returned list as input to the egress baseline diff.
func ExtractEgressTargets(logs []byte) []EgressTarget {
	if len(logs) == 0 {
		return nil
	}
	counts := map[string]int{}
	collect := func(host string) {
		host = normalizeHost(host)
		if host == "" || isInherentHost(host) || isPrivateOrLoopback(host) {
			return
		}
		counts[host]++
	}
	for _, m := range urlPattern.FindAllSubmatch(logs, -1) {
		collect(string(m[1]))
	}
	for _, m := range shellHostPattern.FindAllSubmatch(logs, -1) {
		collect(string(m[1]))
	}

	out := make([]EgressTarget, 0, len(counts))
	for h, c := range counts {
		out = append(out, EgressTarget{Host: h, Count: c})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Count != out[j].Count {
			return out[i].Count > out[j].Count
		}
		return out[i].Host < out[j].Host
	})
	return out
}

// normalizeHost lowercases, strips trailing punctuation, validates the
// shape. Returns "" for anything that doesn't look like a hostname/IP.
func normalizeHost(s string) string {
	s = strings.ToLower(strings.TrimRight(s, ".,;:!?)"))
	if s == "" {
		return ""
	}
	// Reject IPv6 literals (have colons) — keep simple for now.
	if strings.Contains(s, ":") {
		return ""
	}
	if u, err := url.Parse("http://" + s); err == nil && u.Hostname() != "" {
		return u.Hostname()
	}
	return s
}

// inherentHosts are CI/CD provider control-plane and package-registry
// domains the runner contacts as part of normal operation. Filtering them
// keeps the egress finding focused on the unexpected.
var inherentHosts = map[string]bool{
	"api.github.com":                                 true,
	"objects.githubusercontent.com":                  true,
	"pkg.actions.githubusercontent.com":              true,
	"results-receiver.actions.githubusercontent.com": true,
	"gitlab.com":                       true,
	"bitbucket.org":                    true,
	"api.bitbucket.org":                true,
	"dev.azure.com":                    true,
	"app.circleci.com":                 true,
	"dl-cdn.alpinelinux.org":           true,
	"registry.npmjs.org":               true,
	"pypi.org":                         true,
	"files.pythonhosted.org":           true,
	"repo.maven.apache.org":            true,
	"index.docker.io":                  true,
	"registry-1.docker.io":             true,
	"production.cloudflare.docker.com": true,
	"auth.docker.io":                   true,
}

func isInherentHost(host string) bool {
	if inherentHosts[host] {
		return true
	}
	// Subdomain match for common multi-tenant CDNs.
	for _, suffix := range []string{
		".github.com", ".githubusercontent.com", ".gitlab.com", ".bitbucket.org",
		".azure.com", ".azuredevops.com", ".circleci.com", ".visualstudio.com",
	} {
		if strings.HasSuffix(host, suffix) {
			return true
		}
	}
	return false
}

// isPrivateOrLoopback skips localhost, RFC1918, link-local. CI runners
// often hit these during build (test databases, sidecar containers); they
// are not externally observable and can't exfiltrate.
func isPrivateOrLoopback(host string) bool {
	switch host {
	case "localhost", "127.0.0.1", "::1", "0.0.0.0":
		return true
	}
	if strings.HasPrefix(host, "10.") || strings.HasPrefix(host, "192.168.") || strings.HasPrefix(host, "169.254.") {
		return true
	}
	if strings.HasPrefix(host, "172.") {
		// 172.16.0.0 - 172.31.255.255
		parts := strings.Split(host, ".")
		if len(parts) >= 2 {
			for i := 16; i <= 31; i++ {
				if parts[1] == itoaSmall(i) {
					return true
				}
			}
		}
	}
	return false
}

// itoaSmall avoids importing strconv just for two-digit numbers.
func itoaSmall(i int) string {
	if i < 10 {
		return string(rune('0' + i))
	}
	return string(rune('0'+i/10)) + string(rune('0'+i%10))
}
