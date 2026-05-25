package heal

// SecurityFix maps a PipeWarden finding category to an auto-fix action
type SecurityFix struct {
	Category    string
	Pattern     string
	FixFunc     func(configPath string) error
	Description string
}

// Finding represents a PipeWarden security finding for remediation
type Finding struct {
	Category    string
	Title       string
	Description string
	File        string
	Severity    string
	Confidence  float64
}

// FixResult holds the outcome of applying security fixes
type FixResult struct {
	Fixed            bool
	Fixes            []SecurityFix
	FilesModified    []string
	RemediationCount int
}
