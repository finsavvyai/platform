package handlers

import "time"

// ComplianceReport is the full compliance assessment for a framework.
// EvidenceHash is a SHA256 over the canonical (framework, period, sorted
// finding IDs) — auditors can re-derive it to verify the report wasn't
// tampered with after generation.
type ComplianceReport struct {
	Framework    string              `json:"framework"`
	GeneratedAt  time.Time           `json:"generated_at"`
	PeriodFrom   *time.Time          `json:"period_from,omitempty"`
	PeriodTo     *time.Time          `json:"period_to,omitempty"`
	EvidenceHash string              `json:"evidence_hash"`
	Coverage     ComplianceCoverage  `json:"coverage"`
	Summary      ComplianceSummary   `json:"summary"`
	Controls     []ComplianceControl `json:"controls"`
	Findings     []ComplianceFinding `json:"findings"`
}

// ComplianceCoverage attests to the breadth of evidence gathered during
// the reporting period — auditors need to know an empty-findings report
// is "clean" rather than "we didn't scan anything".
type ComplianceCoverage struct {
	ConnectionsScanned int `json:"connections_scanned"`
	RunsScanned        int `json:"runs_scanned"`
	TotalFindings      int `json:"total_findings"`
}

// ComplianceSummary aggregates pass/fail counts and an overall score.
type ComplianceSummary struct {
	TotalControls int `json:"total_controls"`
	Passing       int `json:"passing"`
	Failing       int `json:"failing"`
	NotApplicable int `json:"not_applicable"`
	Score         int `json:"score"` // 0-100
}

// ComplianceControl is a single framework control with pass/fail status.
type ComplianceControl struct {
	ID       string   `json:"id"`
	Title    string   `json:"title"`
	Status   string   `json:"status"`   // "passing" | "failing" | "n/a"
	Findings []string `json:"findings"` // finding IDs that map to this control
}

// ComplianceFinding links a persisted finding to the controls it violates.
type ComplianceFinding struct {
	FindingID int64    `json:"finding_id"`
	Severity  string   `json:"severity"`
	Controls  []string `json:"controls"`
}

// frameworkControl defines a single control in a compliance framework.
type frameworkControl struct {
	id       string
	title    string
	category string // matches finding categories
}

// frameworkControls maps framework name → list of controls.
var frameworkControls = map[string][]frameworkControl{
	"soc2": {
		{id: "CC6.1", title: "Logical and Physical Access Controls — secrets in env", category: "secret"},
		{id: "CC6.6", title: "Logical and Physical Access Controls — unpinned actions", category: "supply-chain"},
		{id: "CC7.2", title: "System Operations — no SAST", category: "policy"},
		{id: "CC8.1", title: "Change Management — unreviewed pipelines", category: "policy"},
	},
	"hipaa": {
		{id: "§164.312(a)(1)", title: "Access Control", category: "secret"},
		{id: "§164.312(b)", title: "Audit Controls", category: "policy"},
		{id: "§164.312(e)(2)(ii)", title: "Encryption and Decryption", category: "secret"},
	},
	"gdpr": {
		{id: "Art.25", title: "Data Protection by Design — data minimization", category: "dlp"},
		{id: "Art.32", title: "Security of Processing — security measures", category: "secret"},
		{id: "Art.33", title: "Notification of Personal Data Breach", category: "policy"},
	},
	"pci-dss": {
		{id: "Req 2.2", title: "System Configuration Hardening", category: "supply-chain"},
		{id: "Req 6.3", title: "Secure Development Practices", category: "secret"},
		{id: "Req 10.3", title: "Audit Log Protection", category: "policy"},
		{id: "Req 12.3", title: "Risk Assessment", category: "policy"},
	},
}

// categoryMatchesControl returns true if a finding category maps to a control.
func categoryMatchesControl(findingCategory, controlCategory string) bool {
	switch controlCategory {
	case "secret":
		return findingCategory == "secret" || findingCategory == "dlp"
	case "supply-chain":
		return findingCategory == "supply-chain"
	case "policy":
		return findingCategory == "policy"
	case "dlp":
		return findingCategory == "dlp" || findingCategory == "secret"
	default:
		return false
	}
}
