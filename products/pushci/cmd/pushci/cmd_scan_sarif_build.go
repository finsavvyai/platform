package main

import (
	"fmt"

	"github.com/finsavvyai/pushci/internal/security"
)

func buildSARIFRules(findings []security.PipelineFinding) []SARIFRule {
	ruleMap := map[string]bool{}
	rules := []SARIFRule{}
	for _, f := range findings {
		ruleID := fmt.Sprintf("pushci/%s", f.Category)
		if ruleMap[ruleID] {
			continue
		}
		ruleMap[ruleID] = true
		rules = append(rules, SARIFRule{
			ID:   ruleID,
			Name: fmt.Sprintf("PushCI: %s", f.Category),
			ShortDescription: SARIFMessage{
				Text: fmt.Sprintf("Checks for %s issues in CI/CD pipelines", f.Category),
			},
			DefaultConfiguration: SARIFConfiguration{Level: findingSeverityToLevel(f.Severity)},
			Tags:                 []string{"security", "pushci", f.Category},
		})
	}
	return rules
}

func buildSARIFResults(findings []security.PipelineFinding) []SARIFResult {
	results := []SARIFResult{}
	for _, f := range findings {
		r := SARIFResult{
			RuleID:  fmt.Sprintf("pushci/%s", f.Category),
			Kind:    "open",
			Level:   findingSeverityToLevel(f.Severity),
			Message: SARIFMessage{Text: f.Title},
			Rank:    findingSeverityToRank(f.Severity),
			Properties: map[string]interface{}{
				"description": f.Description,
				"remediation": f.Remediation,
				"category":    f.Category,
			},
		}
		if loc := buildSARIFLocation(f); loc != nil {
			r.Locations = []SARIFLocation{*loc}
		}
		results = append(results, r)
	}
	return results
}

func buildSARIFLocation(f security.PipelineFinding) *SARIFLocation {
	if f.File == "" {
		return nil
	}
	loc := &SARIFLocation{
		PhysicalLocation: SARIFPhysicalLocation{
			ArtifactLocation: SARIFArtifactLocation{URI: f.File},
		},
	}
	if f.Line > 0 {
		loc.PhysicalLocation.Region = SARIFRegion{StartLine: f.Line}
	}
	return loc
}
