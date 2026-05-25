package handlers

import (
	"net/http"
	"strconv"
	"strings"
)

// FixSuggestion holds actionable remediation steps for a finding.
type FixSuggestion struct {
	FindingID   int64    `json:"finding_id"`
	Title       string   `json:"title"`
	Category    string   `json:"category"`
	Steps       []string `json:"steps"`
	AutoFixable bool     `json:"auto_fixable"`
	PRTemplate  string   `json:"pr_template,omitempty"`
}

var (
	stepsActionPin = []string{
		"Run: npx pin-github-action .github/workflows/*.yml",
		"Replace @v4 refs with SHA pins",
		"Use Dependabot to keep pins updated",
	}
	stepsCurlBash = []string{
		"Download script to file first",
		"Verify checksum before executing",
		"Pin the script version explicitly",
	}
	stepsEOLImage = []string{
		"Update base image to latest LTS",
		"Pin image to digest: image@sha256:...",
		"Add image update to Dependabot config",
	}
	stepsSecretExposure = []string{
		"Move to ${{ secrets.NAME }}",
		"Rotate the exposed credential immediately",
		"Add secret scanning pre-commit hook",
	}
	stepsContainerSecurity = []string{
		"Remove privileged: true",
		"Use specific capabilities instead",
		"Consider rootless container mode",
	}
	stepsNetwork = []string{
		"Use DNS names instead of IPs",
		"Move IPs to environment variables",
		"Document why this IP is hardcoded",
	}
	stepsDefault = []string{
		"Review finding details",
		"Apply principle of least privilege",
		"Add to security backlog",
	}
)

const prTemplateActionPin = `## Security Fix: Pin GitHub Actions to SHA

### Changes
- [ ] Pinned all action refs to full commit SHAs
- [ ] Verified SHA matches expected release tag
- [ ] Added Dependabot config for automated SHA updates

### Verification
` + "```" + `bash
npx pin-github-action .github/workflows/*.yml
` + "```" + `

Resolves security finding: unpinned GitHub Actions`

const prTemplateEOLImage = `## Security Fix: Update EOL Base Image

### Changes
- [ ] Updated base image to latest LTS version
- [ ] Pinned image to digest SHA
- [ ] Added image to Dependabot update config

### Verification
` + "```" + `bash
docker build --no-cache .
` + "```" + `

Resolves security finding: EOL container image`

func fixStepsForFinding(category, title string) ([]string, bool, string) {
	tl := strings.ToLower(title)
	switch category {
	case "supply-chain":
		switch {
		case strings.Contains(tl, "pin") || strings.Contains(tl, "action") || strings.Contains(tl, "unpin"):
			return stepsActionPin, true, prTemplateActionPin
		case strings.Contains(tl, "curl") || strings.Contains(tl, "bash") || strings.Contains(tl, "pipe"):
			return stepsCurlBash, false, ""
		case strings.Contains(tl, "eol") || strings.Contains(tl, "end-of-life") || strings.Contains(tl, "outdated"):
			return stepsEOLImage, true, prTemplateEOLImage
		default:
			return stepsActionPin, true, prTemplateActionPin
		}
	case "secret-exposure":
		return stepsSecretExposure, false, ""
	case "container-security":
		return stepsContainerSecurity, false, ""
	case "network":
		return stepsNetwork, false, ""
	default:
		return stepsDefault, false, ""
	}
}

// GetFixSuggestion handles GET /api/v1/findings/{id}/fix
func (h *Handlers) GetFixSuggestion(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	path := r.URL.Path
	// extract id from /api/v1/findings/{id}/fix
	trimmed := strings.TrimPrefix(path, "/api/v1/findings/")
	trimmed = strings.TrimSuffix(trimmed, "/fix")
	id, err := strconv.ParseInt(trimmed, 10, 64)
	if err != nil {
		jsonError(w, "invalid finding ID", http.StatusBadRequest)
		return
	}

	findings, err := h.db.ListFindings("")
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	for _, f := range findings {
		if f.ID == id {
			steps, autoFixable, prTemplate := fixStepsForFinding(f.Category, f.Title)
			jsonOK(w, FixSuggestion{
				FindingID:   f.ID,
				Title:       f.Title,
				Category:    f.Category,
				Steps:       steps,
				AutoFixable: autoFixable,
				PRTemplate:  prTemplate,
			})
			return
		}
	}

	jsonError(w, "finding not found", http.StatusNotFound)
}
