package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// GenerateSBOM handles GET /api/v1/connections/{name}/sbom.
// It produces a CycloneDX 1.4 JSON SBOM from persisted findings for the connection.
func (h *Handlers) GenerateSBOM(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	name := sbomConnectionName(r.URL.Path)
	if name == "" {
		jsonError(w, "connection name is required", http.StatusBadRequest)
		return
	}

	findings, err := h.db.ListFindings(name)
	if err != nil {
		jsonError(w, fmt.Sprintf("failed to list findings: %s", err), http.StatusInternalServerError)
		return
	}

	doc := buildSBOMDocument(name, findings)

	w.Header().Set("Content-Type", "application/vnd.cyclonedx+json")
	_ = json.NewEncoder(w).Encode(doc)
}

// sbomConnectionName parses the connection name from /api/v1/connections/{name}/sbom.
func sbomConnectionName(path string) string {
	const prefix = "/api/v1/connections/"
	const suffix = "/sbom"
	trimmed := strings.TrimPrefix(path, prefix)
	if !strings.HasSuffix(trimmed, suffix) {
		return ""
	}
	return strings.TrimSuffix(trimmed, suffix)
}

// buildSBOMDocument constructs a CycloneDX 1.4 document from findings.
func buildSBOMDocument(connectionName string, findings []storage.FindingRecord) SBOMDocument {
	return SBOMDocument{
		BOMFormat:   "CycloneDX",
		SpecVersion: "1.4",
		Version:     1,
		Metadata: SBOMMetadata{
			Timestamp: time.Now().UTC().Format(time.RFC3339),
			Tools:     []SBOMTool{{Vendor: "PipeWarden", Name: "pipewarden", Version: "1.0.0"}},
		},
		Components:      sbomComponents(connectionName, findings),
		Vulnerabilities: sbomVulns(findings),
	}
}

// sbomComponents builds one component per unique finding category.
func sbomComponents(connectionName string, findings []storage.FindingRecord) []SBOMComponent {
	seen := map[string]bool{}
	var out []SBOMComponent
	for _, f := range findings {
		if seen[f.Category] {
			continue
		}
		seen[f.Category] = true
		out = append(out, SBOMComponent{
			Type:    "library",
			Name:    f.Category,
			Version: "unknown",
			PURL:    fmt.Sprintf("pkg:generic/pipewarden/%s", connectionName),
		})
	}
	return out
}

// sbomVulns maps each finding to a CycloneDX vulnerability entry.
func sbomVulns(findings []storage.FindingRecord) []SBOMVuln {
	out := make([]SBOMVuln, 0, len(findings))
	for _, f := range findings {
		out = append(out, SBOMVuln{
			ID:     f.Title,
			Source: SBOMSource{Name: "PipeWarden"},
			Ratings: []SBOMRating{
				{Severity: f.Severity, Method: "other"},
			},
			Description: f.Description,
		})
	}
	return out
}
