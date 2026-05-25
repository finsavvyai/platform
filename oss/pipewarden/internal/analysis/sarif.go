package analysis

import (
	"fmt"
	"time"
)

// ToSARIF converts an AnalysisResult to SARIF 2.1.0 format for GitHub Security tab.
func (r *AnalysisResult) ToSARIF() *SARIFReport {
	if r == nil {
		return &SARIFReport{
			Version: "2.1.0",
			Runs:    []SARIFRun{},
		}
	}

	// Create rules from findings categories
	ruleMap := make(map[string]bool)
	rules := []SARIFRule{}

	for _, finding := range r.Findings {
		ruleID := fmt.Sprintf("PW-%s", finding.Category)
		if ruleMap[ruleID] {
			continue
		}
		ruleMap[ruleID] = true

		rule := SARIFRule{
			ID:   ruleID,
			Name: fmt.Sprintf("PipeWarden: %s", finding.Category),
			ShortDescription: SARIFMessage{
				Text: fmt.Sprintf("Checks for %s vulnerabilities", finding.Category),
			},
			FullDescription: SARIFMessage{
				Text: fmt.Sprintf("PipeWarden security check for %s issues in CI/CD pipelines", finding.Category),
			},
			Tags: []string{"security", "pipewarden", string(finding.Category)},
			DefaultConfiguration: SARIFRuleConfig{
				Enabled: true,
				Level:   findingSeverityToLevel(finding.Severity),
			},
		}
		rules = append(rules, rule)
	}

	// Convert findings to SARIF results
	results := []SARIFResult{}
	for i, finding := range r.Findings {
		result := SARIFResult{
			RuleID:    fmt.Sprintf("PW-%s", finding.Category),
			RuleIndex: i,
			Kind:      "open",
			Level:     findingSeverityToLevel(finding.Severity),
			Message: SARIFMessage{
				Text: finding.Title,
			},
			Rank:       findingSeverityToRank(finding.Severity),
			Confidence: finding.Confidence,
			Properties: SARIFResultProperties{
				SecuritySeverity: string(finding.Severity),
				Tags: []string{
					"security",
					"pipewarden",
					string(finding.Category),
				},
			},
		}

		// Add location if file is specified
		if finding.File != "" {
			result.Locations = []SARIFLocation{
				{
					PhysicalLocation: SARIFPhysicalLocation{
						ArtifactLocation: SARIFArtifactLocation{
							URI: finding.File,
						},
						Region: SARIFRegion{
							StartLine: finding.Line,
						},
					},
				},
			}
		}

		// Add remediation fix if available
		if finding.Remediation != "" {
			result.Fixes = []SARIFFix{
				{
					Description: SARIFMessage{
						Text: finding.Remediation,
					},
					ArtifactChanges: []SARIFArtifactChange{
						{
							ArtifactLocation: SARIFArtifactLocation{
								URI: finding.File,
							},
							Replacements: []SARIFReplacement{},
						},
					},
				},
			}
		}

		results = append(results, result)
	}

	// Create the run
	run := SARIFRun{
		Tool: SARIFTool{
			Driver: SARIFDriver{
				Name:           "PipeWarden",
				Version:        "1.0.0",
				InformationURI: "https://pipewarden.io",
				Rules:          rules,
			},
		},
		Results: results,
		Invocations: []SARIFInvocation{
			{
				ExecutionSuccessful: true,
				EndTimeUtc:          time.Now().UTC().Format(time.RFC3339),
			},
		},
	}

	return &SARIFReport{
		Version: "2.1.0",
		Runs:    []SARIFRun{run},
	}
}

// findingSeverityToLevel maps Finding severity to SARIF level.
func findingSeverityToLevel(severity Severity) string {
	switch severity {
	case SeverityCritical:
		return "error"
	case SeverityHigh:
		return "error"
	case SeverityMedium:
		return "warning"
	case SeverityLow:
		return "note"
	case SeverityInfo:
		return "note"
	default:
		return "note"
	}
}

// findingSeverityToRank maps Finding severity to SARIF rank (0.0-100.0).
// Higher rank = higher severity. Used by GitHub for prioritization.
func findingSeverityToRank(severity Severity) float64 {
	switch severity {
	case SeverityCritical:
		return 100.0
	case SeverityHigh:
		return 75.0
	case SeverityMedium:
		return 50.0
	case SeverityLow:
		return 25.0
	case SeverityInfo:
		return 0.0
	default:
		return 0.0
	}
}
