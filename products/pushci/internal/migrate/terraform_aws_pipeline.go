package migrate

import (
	"regexp"
	"strings"
)

// mapAssignRE matches `configuration = { ... }` — CodePipeline's
// action configuration uses a map literal, not a nested block. We grab
// the body with balanced braces via findMatchingBrace.
var mapAssignRE = regexp.MustCompile(`(?m)^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\{`)

// extractAWSCodePipeline parses an `aws_codepipeline` resource: the
// stage/action topology maps cleanly onto ExtractedStage.
func extractAWSCodePipeline(block tfBlock, result *TerraformPipelineResult, dir string) {
	attrs := parseTerraformAttrs(block.Body)
	pipe := ExtractedPipeline{
		Platform: "aws-codepipeline",
		Name:     resolveTFName(unquoteTF(attrs["name"]), dir, block.Labels[1]),
		EnvVars:  map[string]string{},
		RawHCL:   block.Raw,
	}
	for _, stage := range parseTerraformBlocks(block.Body) {
		if stage.Kind != "stage" {
			continue
		}
		pipe.Stages = append(pipe.Stages, extractCodePipelineStage(stage))
	}
	result.Pipelines = append(result.Pipelines, pipe)
}

func extractCodePipelineStage(stage tfBlock) ExtractedStage {
	sa := parseTerraformAttrs(stage.Body)
	out := ExtractedStage{Name: unquoteTF(sa["name"]), Config: map[string]string{}}
	for _, act := range parseTerraformBlocks(stage.Body) {
		if act.Kind != "action" {
			continue
		}
		aa := parseTerraformAttrs(act.Body)
		out.Actions = append(out.Actions, unquoteTF(aa["name"]))
		if out.Provider == "" {
			out.Provider = unquoteTF(aa["provider"])
		}
		mergeMapAssign(act.Body, "configuration", out.Config)
	}
	return out
}

// mergeMapAssign extracts `<key> = { ... }` map literal assignments
// (as used by CodePipeline action configuration) and merges them into
// dst with unquoted string values.
func mergeMapAssign(body, key string, dst map[string]string) {
	idx := 0
	for {
		rest := body[idx:]
		m := mapAssignRE.FindStringSubmatchIndex(rest)
		if m == nil {
			return
		}
		name := rest[m[2]:m[3]]
		braceOff := strings.IndexByte(rest[m[0]:], '{')
		if braceOff < 0 {
			return
		}
		openAbs := idx + m[0] + braceOff
		endAbs := findMatchingBrace(body, openAbs)
		if endAbs < 0 {
			return
		}
		if name == key {
			for k, v := range parseTerraformAttrs(body[openAbs+1 : endAbs]) {
				dst[k] = unquoteTF(v)
			}
		}
		idx = endAbs + 1
	}
}
