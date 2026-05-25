package exports

import (
	"encoding/json"
	"fmt"
)

type Finding struct {
	ID          int64
	Title       string
	Description string
	Severity    string
	File        string
	Line        int
	Confidence  float64
	Category    string
}

type ExportOptions struct {
	IncludeRules bool
	IncludeHelp  bool
}

func ExportSARIF(findings []Finding, opts ExportOptions) ([]byte, error) {
	results := make([]SARIFResult, 0, len(findings))

	for _, f := range findings {
		level := mapSeverityToLevel(f.Severity)

		region := &SARIFRegion{
			StartLine: f.Line,
		}
		if f.Line == 0 {
			region = nil
		}

		result := SARIFResult{
			RuleID: fmt.Sprintf("pipewarden/%s", f.Category),
			Level:  level,
			Message: SARIFMessage{
				Text: f.Title,
			},
			Locations: []SARIFLocation{
				{
					PhysicalLocation: SARIFPhysicalLocation{
						ArtifactLocation: SARIFArtifactLocation{
							URI: f.File,
						},
						Region: region,
					},
				},
			},
			Properties: map[string]interface{}{
				"confidence": f.Confidence,
				"finding_id": f.ID,
			},
		}

		results = append(results, result)
	}

	rules := make([]SARIFRule, 0)
	if opts.IncludeRules {
		rules = buildRules(findings)
	}

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
	}

	log := SARIFLog{
		Version: "2.1.0",
		Runs:    []SARIFRun{run},
	}

	return json.MarshalIndent(log, "", "  ")
}

func mapSeverityToLevel(severity string) string {
	switch severity {
	case "critical":
		return "error"
	case "high":
		return "error"
	case "medium":
		return "warning"
	case "low":
		return "note"
	default:
		return "none"
	}
}

func buildRules(findings []Finding) []SARIFRule {
	ruleMap := make(map[string]SARIFRule)

	for _, f := range findings {
		ruleID := fmt.Sprintf("pipewarden/%s", f.Category)
		if _, exists := ruleMap[ruleID]; !exists {
			rule := SARIFRule{
				ID: ruleID,
				ShortDescription: SARIFDescription{
					Text: f.Category,
				},
				FullDescription: &SARIFDescription{
					Text: f.Description,
				},
				DefaultConfiguration: SARIFConfiguration{
					Level: mapSeverityToLevel(f.Severity),
				},
			}
			ruleMap[ruleID] = rule
		}
	}

	rules := make([]SARIFRule, 0, len(ruleMap))
	for _, rule := range ruleMap {
		rules = append(rules, rule)
	}
	return rules
}
