package compliance

import (
	"errors"
	"time"
)

// ComplianceFramework represents a regulatory compliance standard.
type ComplianceFramework string

const (
	SOC2    ComplianceFramework = "SOC2"
	PCI_DSS ComplianceFramework = "PCI_DSS"
	GDPR    ComplianceFramework = "GDPR"
	HIPAA   ComplianceFramework = "HIPAA"
)

// ControlStatus represents the compliance state of a control.
type ControlStatus string

const (
	Compliant     ControlStatus = "COMPLIANT"
	NonCompliant  ControlStatus = "NON_COMPLIANT"
	Partial       ControlStatus = "PARTIAL"
	NotApplicable ControlStatus = "NOT_APPLICABLE"
	PendingReview ControlStatus = "PENDING_REVIEW"
)

// EvidenceType represents the category of compliance evidence.
type EvidenceType string

const (
	AuditLog        EvidenceType = "AUDIT_LOG"
	RBACConfig      EvidenceType = "RBAC_CONFIG"
	EncryptionConf  EvidenceType = "ENCRYPTION_CONFIG"
	CICDLog         EvidenceType = "CI_CD_LOG"
	MonitoringAlert EvidenceType = "MONITORING_ALERT"
	ManualUpload    EvidenceType = "MANUAL_UPLOAD"
)

// EvidenceItem represents a piece of evidence supporting a control.
type EvidenceItem struct {
	ID          string       `json:"id"`
	ControlID   string       `json:"control_id"`
	Type        EvidenceType `json:"type"`
	Source      string       `json:"source"`
	CollectedAt time.Time    `json:"collected_at"`
	Data        string       `json:"data"`
	Verified    bool         `json:"verified"`
	Hash        string       `json:"hash"`
}

// Control represents a single compliance control within a framework.
type Control struct {
	ID               string              `json:"id"`
	Framework        ComplianceFramework `json:"framework"`
	Category         string              `json:"category"`
	Title            string              `json:"title"`
	Description      string              `json:"description"`
	Status           ControlStatus       `json:"status"`
	Evidence         []EvidenceItem      `json:"evidence"`
	LastAssessedAt   *time.Time          `json:"last_assessed_at"`
	RemediationSteps string              `json:"remediation_steps"`
}

// ComplianceReport aggregates controls for a framework assessment.
type ComplianceReport struct {
	ID                string              `json:"id"`
	TenantID          string              `json:"tenant_id"`
	Framework         ComplianceFramework `json:"framework"`
	GeneratedAt       time.Time           `json:"generated_at"`
	Controls          []Control           `json:"controls"`
	Score             float64             `json:"score"`
	TotalControls     int                 `json:"total_controls"`
	CompliantControls int                 `json:"compliant_controls"`
	Gaps              []Control           `json:"gaps"`
}

// FrameworkScore holds scoring data for a single framework.
type FrameworkScore struct {
	Framework        ComplianceFramework `json:"framework"`
	Score            float64             `json:"score"`
	TotalControls    int                 `json:"total_controls"`
	CompliantControls int                `json:"compliant_controls"`
	Trend            float64             `json:"trend"`
}

// Deadline represents an upcoming compliance deadline.
type Deadline struct {
	Framework   ComplianceFramework `json:"framework"`
	Description string              `json:"description"`
	DueDate     time.Time           `json:"due_date"`
}

// ComplianceDashboardStats provides an overview across all frameworks.
type ComplianceDashboardStats struct {
	Frameworks          []FrameworkScore `json:"frameworks"`
	OverallScore        float64          `json:"overall_score"`
	TotalControls       int              `json:"total_controls"`
	CompliantControls   int              `json:"compliant_controls"`
	NonCompliantControls int             `json:"non_compliant_controls"`
	UpcomingDeadlines   []Deadline       `json:"upcoming_deadlines"`
}

// Validation errors returned by ValidateControl.
var (
	ErrMissingControlID    = errors.New("control ID is required")
	ErrMissingFramework    = errors.New("framework is required")
	ErrMissingTitle        = errors.New("title is required")
	ErrInvalidFramework    = errors.New("invalid compliance framework")
	ErrInvalidControlStatus = errors.New("invalid control status")
)

// ValidateControl checks required fields and enum validity on a Control.
func ValidateControl(c Control) error {
	if c.ID == "" {
		return ErrMissingControlID
	}
	if c.Framework == "" {
		return ErrMissingFramework
	}
	if c.Title == "" {
		return ErrMissingTitle
	}
	if !isValidFramework(c.Framework) {
		return ErrInvalidFramework
	}
	if c.Status != "" && !isValidStatus(c.Status) {
		return ErrInvalidControlStatus
	}
	return nil
}

func isValidFramework(f ComplianceFramework) bool {
	switch f {
	case SOC2, PCI_DSS, GDPR, HIPAA:
		return true
	}
	return false
}

func isValidStatus(s ControlStatus) bool {
	switch s {
	case Compliant, NonCompliant, Partial, NotApplicable, PendingReview:
		return true
	}
	return false
}

// CalculateScore sets Score, TotalControls, and CompliantControls
// based on the report's Controls slice.
func (r *ComplianceReport) CalculateScore() {
	r.TotalControls = len(r.Controls)
	r.CompliantControls = 0
	for _, c := range r.Controls {
		if c.Status == Compliant {
			r.CompliantControls++
		}
	}
	if r.TotalControls == 0 {
		r.Score = 0
		return
	}
	r.Score = float64(r.CompliantControls) / float64(r.TotalControls) * 100
}

// FindGaps populates the Gaps field with controls that are not compliant.
func (r *ComplianceReport) FindGaps() {
	r.Gaps = nil
	for _, c := range r.Controls {
		if c.Status == NonCompliant || c.Status == Partial {
			r.Gaps = append(r.Gaps, c)
		}
	}
}

// FrameworkDisplayName returns a human-readable name for a framework.
func FrameworkDisplayName(f ComplianceFramework) string {
	switch f {
	case SOC2:
		return "SOC 2"
	case PCI_DSS:
		return "PCI DSS"
	case GDPR:
		return "GDPR"
	case HIPAA:
		return "HIPAA"
	default:
		return string(f)
	}
}
