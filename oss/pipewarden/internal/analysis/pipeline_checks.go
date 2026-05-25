package analysis

import (
	"fmt"
	"net"
	"regexp"
	"strings"
)

var (
	curlPipeRe  = regexp.MustCompile(`(?i)(curl|wget)\s+[^\|]+\|\s*(ba)?sh`)
	ipv4Re      = regexp.MustCompile(`\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b`)
	envSecretRe = regexp.MustCompile(`(?im)^\s*[\w]*(?:API_KEY|TOKEN|PASSWORD|SECRET|PASSWD|CREDENTIALS?|AUTH)[_\w]*\s*=\s*([^\$\s"'\n]{8,})`)

	eolImages = []string{
		"ubuntu:18.04", "ubuntu:16.04", "ubuntu:14.04",
		"debian:9", "debian:8",
		"node:14", "node:13", "node:12", "node:11", "node:10",
		"python:3.8", "python:3.7", "python:3.6",
		"alpine:3.13", "alpine:3.12",
	}
)

// CheckCurlPipeSh detects remote script execution via curl/wget piped to a shell.
func CheckCurlPipeSh(content string) []Finding {
	var findings []Finding
	if curlPipeRe.MatchString(content) {
		findings = append(findings, Finding{
			Severity:    SeverityCritical,
			Category:    "supply-chain",
			Title:       "Remote script execution via curl|wget pipe",
			Description: "Pipeline contains a 'curl|wget ... | sh/bash' pattern. This executes arbitrary remote code at runtime and is a critical supply-chain attack vector.",
			Remediation: "Download the script separately, verify its checksum/signature, then execute it. Never pipe remote content directly into a shell.",
			Confidence:  0.95,
			Status:      "open",
		})
	}
	return findings
}

// CheckHardcodedIPs detects hardcoded external IPv4 addresses in pipeline config.
func CheckHardcodedIPs(content string) []Finding {
	var findings []Finding
	seen := map[string]bool{}
	for _, m := range ipv4Re.FindAllStringSubmatch(content, -1) {
		ip := m[0]
		if seen[ip] {
			continue
		}
		seen[ip] = true
		parsed := net.ParseIP(ip)
		if parsed == nil {
			continue
		}
		if parsed.IsLoopback() || parsed.IsUnspecified() || parsed.IsPrivate() {
			continue
		}
		findings = append(findings, Finding{
			Severity:    SeverityMedium,
			Category:    "network",
			Title:       "Hardcoded external IP address",
			Description: fmt.Sprintf("Hardcoded IP %s found in pipeline config. External IPs are fragile, hard to rotate, and may point to attacker-controlled infrastructure.", ip),
			Remediation: "Replace hardcoded IPs with DNS hostnames or environment variables/secrets so infrastructure can be updated without modifying pipeline code.",
			Confidence:  0.75,
			Status:      "open",
		})
	}
	return findings
}

// CheckPrivilegedContainer detects privileged: true in pipeline YAML.
func CheckPrivilegedContainer(content string) []Finding {
	var findings []Finding
	privRe := regexp.MustCompile(`(?i)privileged\s*:\s*true`)
	if privRe.MatchString(content) {
		findings = append(findings, Finding{
			Severity:    SeverityHigh,
			Category:    "container-security",
			Title:       "Privileged container mode enabled",
			Description: "Pipeline uses 'privileged: true' which grants the container full host capabilities. This enables Docker-in-Docker abuse, container escapes, and host compromise.",
			Remediation: "Remove 'privileged: true'. Use rootless Docker, Kaniko, or Buildah for container image builds. If unavoidable, restrict to dedicated hardened runners.",
			Confidence:  0.95,
			Status:      "open",
		})
	}
	return findings
}

// CheckOutdatedBaseImages detects EOL base images in pipeline YAML.
func CheckOutdatedBaseImages(content string) []Finding {
	var findings []Finding
	lower := strings.ToLower(content)
	for _, img := range eolImages {
		if strings.Contains(lower, "image: "+img) || strings.Contains(lower, "image:"+img) {
			findings = append(findings, Finding{
				Severity:    SeverityMedium,
				Category:    "supply-chain",
				Title:       "EOL base image in use",
				Description: fmt.Sprintf("Pipeline references '%s' which has reached End-of-Life and no longer receives security patches.", img),
				Remediation: fmt.Sprintf("Upgrade from '%s' to a supported LTS version. Check the official image page for the current supported tags.", img),
				Confidence:  0.90,
				Status:      "open",
			})
		}
	}
	return findings
}

// CheckEnvVarSecrets detects potential plaintext secrets in env var assignments.
func CheckEnvVarSecrets(content string) []Finding {
	var findings []Finding
	matches := envSecretRe.FindAllStringSubmatch(content, -1)
	seen := map[string]bool{}
	for _, m := range matches {
		line := strings.TrimSpace(m[0])
		if seen[line] {
			continue
		}
		seen[line] = true
		// Skip if value is a secret reference (${{ secrets.X }}, $VAR, $(cmd))
		val := m[1]
		if strings.HasPrefix(val, "$") || strings.HasPrefix(val, "$(") {
			continue
		}
		findings = append(findings, Finding{
			Severity:    SeverityHigh,
			Category:    "secret-exposure",
			Title:       "Potential secret in environment variable",
			Description: fmt.Sprintf("Environment variable assignment appears to contain a hardcoded secret value: '%s'. Plaintext secrets in pipeline config are exposed in version control and CI logs.", line),
			Remediation: "Move secret values to your CI/CD secret store (e.g. GitHub Secrets, GitLab CI Variables) and reference them as ${{ secrets.VAR_NAME }} instead of hardcoding.",
			Confidence:  0.80,
			Status:      "open",
		})
	}
	return findings
}
