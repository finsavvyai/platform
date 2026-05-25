package migrate

import "gopkg.in/yaml.v3"

// cloudBuildConfig is the subset of cloudbuild.yaml we translate.
// Reference: https://cloud.google.com/build/docs/build-config-file-schema
type cloudBuildConfig struct {
	Steps         []cloudBuildStep  `yaml:"steps"`
	Timeout       string            `yaml:"timeout,omitempty"`
	Options       cloudBuildOptions `yaml:"options,omitempty"`
	Substitutions map[string]string `yaml:"substitutions,omitempty"`
	Secrets       []cloudBuildSec   `yaml:"secrets,omitempty"`
	Images        []string          `yaml:"images,omitempty"`
	Artifacts     cloudBuildArt     `yaml:"artifacts,omitempty"`
	Tags          []string          `yaml:"tags,omitempty"`
}

// cloudBuildStep maps the per-step fields. `name` is the Docker image,
// NOT a human label.
type cloudBuildStep struct {
	Name       string   `yaml:"name"`
	Args       []string `yaml:"args,omitempty"`
	Env        []string `yaml:"env,omitempty"`
	ID         string   `yaml:"id,omitempty"`
	WaitFor    []string `yaml:"waitFor,omitempty"`
	Entrypoint string   `yaml:"entrypoint,omitempty"`
	Dir        string   `yaml:"dir,omitempty"`
	Timeout    string   `yaml:"timeout,omitempty"`
	SecretEnv  []string `yaml:"secretEnv,omitempty"`
	Volumes    []cloudBuildVol
}

type cloudBuildVol struct {
	Name string `yaml:"name"`
	Path string `yaml:"path"`
}

type cloudBuildOptions struct {
	MachineType string `yaml:"machineType,omitempty"`
	Logging     string `yaml:"logging,omitempty"`
}

type cloudBuildSec struct {
	KMSKeyName string            `yaml:"kmsKeyName,omitempty"`
	SecretEnv  map[string]string `yaml:"secretEnv,omitempty"`
}

type cloudBuildArt struct {
	Objects struct {
		Location string   `yaml:"location,omitempty"`
		Paths    []string `yaml:"paths,omitempty"`
	} `yaml:"objects,omitempty"`
}

func parseCloudBuild(data []byte) (*cloudBuildConfig, error) {
	cfg := &cloudBuildConfig{}
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}
