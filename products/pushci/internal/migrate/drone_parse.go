package migrate

import (
	"bytes"

	"gopkg.in/yaml.v3"
)

// parseDroneDocs splits a multi-document YAML stream into dronePipeline values.
func parseDroneDocs(data []byte) ([]dronePipeline, error) {
	dec := yaml.NewDecoder(bytes.NewReader(data))
	var out []dronePipeline
	for {
		var p dronePipeline
		if err := dec.Decode(&p); err != nil {
			if err.Error() == "EOF" {
				break
			}
			return nil, err
		}
		out = append(out, p)
	}
	return out, nil
}

// dronePipeline mirrors a single `kind: pipeline` document in a .drone.yml.
type dronePipeline struct {
	Kind      string                   `yaml:"kind"`
	Type      string                   `yaml:"type"`
	Name      string                   `yaml:"name"`
	Workspace map[string]interface{}   `yaml:"workspace,omitempty"`
	Steps     []droneStep              `yaml:"steps"`
	Services  []droneStep              `yaml:"services,omitempty"`
	Trigger   map[string]interface{}   `yaml:"trigger,omitempty"`
	DependsOn []string                 `yaml:"depends_on,omitempty"`
	Volumes   []map[string]interface{} `yaml:"volumes,omitempty"`
}

// droneStep is a single step inside a pipeline. Services reuse the same shape.
type droneStep struct {
	Name        string                   `yaml:"name"`
	Image       string                   `yaml:"image,omitempty"`
	Commands    []string                 `yaml:"commands,omitempty"`
	Environment map[string]string        `yaml:"environment,omitempty"`
	When        map[string]interface{}   `yaml:"when,omitempty"`
	DependsOn   []string                 `yaml:"depends_on,omitempty"`
	Settings    map[string]interface{}   `yaml:"settings,omitempty"`
	Volumes     []map[string]interface{} `yaml:"volumes,omitempty"`
	Failure     string                   `yaml:"failure,omitempty"`
	Detach      bool                     `yaml:"detach,omitempty"`
}
