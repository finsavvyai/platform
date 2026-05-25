package handlers

// SBOMDocument is a CycloneDX 1.4 Software Bill of Materials document.
type SBOMDocument struct {
	BOMFormat       string          `json:"bomFormat"`
	SpecVersion     string          `json:"specVersion"`
	Version         int             `json:"version"`
	Metadata        SBOMMetadata    `json:"metadata"`
	Components      []SBOMComponent `json:"components"`
	Vulnerabilities []SBOMVuln      `json:"vulnerabilities"`
}

// SBOMMetadata holds document-level metadata.
type SBOMMetadata struct {
	Timestamp string     `json:"timestamp"`
	Tools     []SBOMTool `json:"tools"`
}

// SBOMTool describes a tool used to generate the SBOM.
type SBOMTool struct {
	Vendor  string `json:"vendor"`
	Name    string `json:"name"`
	Version string `json:"version"`
}

// SBOMComponent represents a software component.
type SBOMComponent struct {
	Type    string `json:"type"`
	Name    string `json:"name"`
	Version string `json:"version"`
	PURL    string `json:"purl"`
}

// SBOMVuln represents a vulnerability in a CycloneDX document.
type SBOMVuln struct {
	ID          string       `json:"id"`
	Source      SBOMSource   `json:"source"`
	Ratings     []SBOMRating `json:"ratings"`
	Description string       `json:"description"`
}

// SBOMSource identifies the source of a vulnerability.
type SBOMSource struct {
	Name string `json:"name"`
}

// SBOMRating holds the severity rating of a vulnerability.
type SBOMRating struct {
	Severity string `json:"severity"`
	Method   string `json:"method"`
}
