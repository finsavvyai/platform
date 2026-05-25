package detect

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// terraformPipelineMaxDepth caps the walk. .tf files for pipelines
// live at root or under infra/terraform/ a level deep; three is
// generous without risking runaway vendored modules.
const terraformPipelineMaxDepth = 3

// tfPipelineResources maps Terraform resource type names to the
// CIProvider marker emitted when at least one `resource "<type>"`
// declaration is found. Ordered for deterministic output.
var tfPipelineResources = []struct {
	Resource string
	Marker   string
}{
	{"aws_codebuild_project", "ci:aws-codebuild-tf"},
	{"aws_codepipeline", "ci:aws-codepipeline-tf"},
	{"google_cloudbuild_trigger", "ci:gcp-cloudbuild-tf"},
	{"azuredevops_build_definition", "ci:azure-devops-tf"},
	{"harness_platform_pipeline", "ci:harness-tf"},
}

// resourceDeclRe matches a top-level `resource "<type>" "<name>" {`
// declaration. We strip comments first (preprocessHcl) so commented-
// out resources don't produce false positives.
var resourceDeclRe = regexp.MustCompile(`resource\s+"([A-Za-z0-9_]+)"\s+"[^"]*"\s*\{`)

// ScanTerraformPipelines walks root for .tf files and emits ONE
// CIProvider per detected pipeline resource type (deduped across
// the whole repo). ConfigFile holds the first .tf file where the
// marker was observed — useful context for migration prompts.
func ScanTerraformPipelines(root string) []CIProvider {
	firstHit := map[string]string{}
	filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			if skipDirs[info.Name()] || info.Name() == ".terraform" {
				return filepath.SkipDir
			}
			d := strings.Count(strings.TrimPrefix(path, root), string(os.PathSeparator))
			if d > terraformPipelineMaxDepth {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(info.Name(), ".tf") {
			return nil
		}
		data, err := os.ReadFile(path) // #nosec G703 G704 G122 -- CLI tool: paths/URLs are user-supplied
		if err != nil {
			return nil
		}
		for _, m := range resourceDeclRe.FindAllStringSubmatch(preprocessHcl(string(data)), -1) {
			marker := markerForResource(m[1])
			if marker == "" {
				continue
			}
			if _, ok := firstHit[marker]; ok {
				continue
			}
			rel, err := filepath.Rel(root, path)
			if err != nil {
				rel = path
			}
			firstHit[marker] = filepath.ToSlash(rel)
		}
		return nil
	})
	if len(firstHit) == 0 {
		return nil
	}
	out := make([]CIProvider, 0, len(firstHit))
	for _, e := range tfPipelineResources {
		if cfg, ok := firstHit[e.Marker]; ok {
			out = append(out, CIProvider{Marker: e.Marker, ConfigFile: cfg})
		}
	}
	return out
}

// markerForResource returns the CI marker for a Terraform resource
// type or "" if the type is not tracked.
func markerForResource(resource string) string {
	for _, e := range tfPipelineResources {
		if e.Resource == resource {
			return e.Marker
		}
	}
	return ""
}
