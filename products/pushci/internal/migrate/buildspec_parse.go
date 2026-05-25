package migrate

import "gopkg.in/yaml.v3"

// buildspecFile is the minimal shape of an AWS CodeBuild buildspec.yml.
// Only the fields we actually consume are parsed; everything else is
// surfaced as warnings rather than silently dropped.
type buildspecFile struct {
	Version   interface{}                `yaml:"version"`
	RunAs     string                     `yaml:"run-as"`
	Env       buildspecEnv               `yaml:"env"`
	Phases    map[string]buildspecPhase  `yaml:"phases"`
	Artifacts buildspecArtifacts         `yaml:"artifacts"`
	Cache     buildspecCache             `yaml:"cache"`
	Reports   map[string]buildspecReport `yaml:"reports"`
}

type buildspecEnv struct {
	Shell             string            `yaml:"shell"`
	Variables         map[string]string `yaml:"variables"`
	ParameterStore    map[string]string `yaml:"parameter-store"`
	SecretsManager    map[string]string `yaml:"secrets-manager"`
	ExportedVariables []string          `yaml:"exported-variables"`
	GitCredHelper     interface{}       `yaml:"git-credential-helper"`
}

type buildspecPhase struct {
	RuntimeVersions map[string]interface{} `yaml:"runtime-versions"`
	Commands        []string               `yaml:"commands"`
	Finally         []string               `yaml:"finally"`
	OnFailure       string                 `yaml:"on-failure"`
}

type buildspecArtifacts struct {
	Files         []string `yaml:"files"`
	BaseDirectory string   `yaml:"base-directory"`
	DiscardPaths  bool     `yaml:"discard-paths"`
	Name          string   `yaml:"name"`
}

type buildspecCache struct {
	Paths []string `yaml:"paths"`
}

type buildspecReport struct {
	Files      []string `yaml:"files"`
	FileFormat string   `yaml:"file-format"`
	BaseDir    string   `yaml:"base-directory"`
}

// parseBuildspec unmarshals the YAML into buildspecFile. We accept
// the yaml v3 `yes`/`no` → bool coercion for discard-paths, and leave
// `version` as interface{} since AWS allows both 0.1 and 0.2 numerics.
func parseBuildspec(rawYAML string) (*buildspecFile, error) {
	var spec buildspecFile
	if err := yaml.Unmarshal([]byte(rawYAML), &spec); err != nil {
		return nil, err
	}
	if spec.Phases == nil {
		spec.Phases = map[string]buildspecPhase{}
	}
	return &spec, nil
}
