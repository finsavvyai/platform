package migrate

import (
	"fmt"
	"regexp"
	"strings"
)

// heredocStartRE matches the opening of a Terraform heredoc assignment:
// `yaml = <<-EOT\n` or `yaml = <<EOT\n`. Go RE2 has no backrefs so we
// scan for the closing tag manually.
var heredocStartRE = regexp.MustCompile(`yaml\s*=\s*<<(-?)([A-Z][A-Z0-9_]*)\s*\n`)

// extractHarnessPipeline parses a `harness_platform_pipeline` resource.
// Docs: https://registry.terraform.io/providers/harness/harness/latest/docs/resources/platform_pipeline
//
// Harness embeds an entire YAML pipeline inside a heredoc on the `yaml`
// attribute. We surface it via RawHCL + a warning so the user can run
// the dedicated Harness YAML migrator next.
func extractHarnessPipeline(block tfBlock, result *TerraformPipelineResult) {
	attrs := parseTerraformAttrs(block.Body)
	pipe := ExtractedPipeline{
		Platform: "harness",
		Name:     unquoteTF(attrs["name"]),
		EnvVars:  map[string]string{},
		RawHCL:   block.Raw,
	}
	if pipe.Name == "" {
		pipe.Name = unquoteTF(attrs["identifier"])
	}
	if pipe.Name == "" {
		pipe.Name = block.Labels[1]
	}
	yml := extractHarnessYAML(block.Body)
	if yml != "" {
		pipe.BuildspecRef = "<inline harness yaml>"
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("harness_platform_pipeline.%s: embeds Harness YAML inline — extract and translate manually",
				block.Labels[1]))
	}
	result.Pipelines = append(result.Pipelines, pipe)
}

// extractHarnessYAML pulls the heredoc body out of the `yaml = <<EOT`
// attribute, if present. Returns the raw YAML text (no stripping).
func extractHarnessYAML(body string) string {
	m := heredocStartRE.FindStringSubmatchIndex(body)
	if m == nil {
		return ""
	}
	tag := body[m[4]:m[5]]
	contentStart := m[1]
	rest := body[contentStart:]
	// Closing tag must be on its own line (optionally indented).
	for _, line := range splitLinesKeep(rest) {
		trimmed := strings.TrimSpace(line.text)
		if trimmed == tag {
			return strings.TrimSpace(rest[:line.start])
		}
	}
	return ""
}

type lineRef struct {
	start int
	text  string
}

func splitLinesKeep(s string) []lineRef {
	var out []lineRef
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			out = append(out, lineRef{start: start, text: s[start:i]})
			start = i + 1
		}
	}
	if start < len(s) {
		out = append(out, lineRef{start: start, text: s[start:]})
	}
	return out
}
