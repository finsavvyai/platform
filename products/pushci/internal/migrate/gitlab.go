package migrate

import (
	"gopkg.in/yaml.v3"
)

// GitLabCI represents a parsed .gitlab-ci.yml.
type GitLabCI struct {
	Stages    []string             `yaml:"stages"`
	Variables map[string]string    `yaml:"variables"`
	Jobs      map[string]GitLabJob `yaml:"-"`
	RawYAML   string               `yaml:"-"`
}

// GitLabJob represents a job in .gitlab-ci.yml. Permissive types
// on Image / Needs / Except / Only because GitLab accepts both
// scalar and mapping forms for these fields, and a strict []string
// or `string` would force the entire job to drop on unmarshal —
// the bug that hid scan/promote/sonarqube jobs in vala-gate.
type GitLabJob struct {
	Stage        string            `yaml:"stage"`
	Image        interface{}       `yaml:"image"`
	Script       []string          `yaml:"script"`
	BeforeScript []string          `yaml:"before_script"`
	AfterScript  []string          `yaml:"after_script"`
	Environment  interface{}       `yaml:"environment"`
	Only         interface{}       `yaml:"only"`
	Except       interface{}       `yaml:"except"`
	Variables    map[string]string `yaml:"variables"`
	Artifacts    *GitLabArtifacts  `yaml:"artifacts"`
	Needs        interface{}       `yaml:"needs"`
	Rules        []GitLabRule      `yaml:"rules"`
}

// GitLabArtifacts defines job artifacts.
type GitLabArtifacts struct {
	Paths []string `yaml:"paths"`
}

// GitLabRule defines conditional job execution.
type GitLabRule struct {
	If   string `yaml:"if"`
	When string `yaml:"when"`
}

// GitLabConvertResult holds the migration output.
type GitLabConvertResult struct {
	PushCIYAML      string
	StagesConverted int
	JobsConverted   int
	JobsSkipped     int
	Warnings        []string
	EnvVarsNeeded   []EnvVarRef
	DeployHints     []DeployHint
}

// ConvertGitLab converts a .gitlab-ci.yml to PushCI format.
func ConvertGitLab(rawYAML string) *GitLabConvertResult {
	result := &GitLabConvertResult{}

	// GitLab `!reference [.anchor, key]` is GitLab-only — yaml.v3
	// leaves the tag in place but loses type info, which makes
	// every job that uses one fail to decode into GitLabJob. Inline
	// references first so the rest of the pipeline parses cleanly.
	rawYAML = expandGitLabReferences(rawYAML)

	var raw map[string]interface{}
	if err := yaml.Unmarshal([]byte(rawYAML), &raw); err != nil {
		result.Warnings = append(result.Warnings, "Failed to parse .gitlab-ci.yml: "+err.Error())
		return result
	}

	stages := extractStages(raw)
	globalVars := extractGlobalVars(raw)
	setupScripts := extractTopLevelScriptList(raw, "before_script")
	cleanupScripts := extractTopLevelScriptList(raw, "after_script")
	stageJobs, stageEnvs, stageOnly := extractJobs(raw, result)

	if len(stages) == 0 {
		stages = []string{"test"}
	}

	stages, stageJobs = injectSetupCleanup(stages, stageJobs, setupScripts, cleanupScripts, result)
	warnIncludes(raw, result)
	result.DeployHints = InferDeployHintsFromScripts(stageJobs, ".gitlab-ci.yml")
	result.PushCIYAML = buildGitLabYAML(stages, stageJobs, stageEnvs, stageOnly, result)
	appendGlobalVarWarnings(globalVars, result)
	return result
}
