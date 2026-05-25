package pipeline

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
	"gopkg.in/yaml.v3"
)

// ChangeType describes what kind of pipeline update is needed.
type ChangeType string

const (
	ChangeAdd    ChangeType = "add"
	ChangeRemove ChangeType = "remove"
	ChangeModify ChangeType = "modify"
)

// Change represents a single pipeline update suggestion.
type Change struct {
	Type        ChangeType
	Description string
	Suggestion  string
}

// Updater compares current pushci.yml with repo state.
type Updater struct{}

// NewUpdater creates an Updater.
func NewUpdater() *Updater { return &Updater{} }

// Check compares pushci.yml with detected projects.
func (u *Updater) Check(root string) ([]Change, error) {
	projects := detect.Scan(root)
	cfgPath := filepath.Join(root, "pushci.yml")
	pipe, err := config.Load(cfgPath)
	if err != nil {
		return nil, fmt.Errorf("load config: %w", err)
	}
	return diffPipeline(pipe, projects), nil
}

func diffPipeline(pipe *config.Pipeline, projects []detect.Project) []Change {
	existing := existingStacks(pipe)
	var changes []Change
	for _, p := range projects {
		key := string(p.Stack)
		if p.Framework != "" {
			key += "/" + p.Framework
		}
		if !existing[key] {
			changes = append(changes, Change{
				Type:        ChangeAdd,
				Description: fmt.Sprintf("New %s project detected in repo", key),
				Suggestion:  fmt.Sprintf("Add %s checks to pipeline", key),
			})
		}
	}
	return changes
}

func existingStacks(pipe *config.Pipeline) map[string]bool {
	stacks := map[string]bool{}
	for _, c := range pipe.Checks {
		stacks[c.Name] = true
		if c.Run != "" {
			stacks[c.Run] = true
		}
	}
	return stacks
}

// Apply writes updated pushci.yml with the suggested changes.
func (u *Updater) Apply(root string, changes []Change) error {
	cfgPath := filepath.Join(root, "pushci.yml")
	pipe, err := config.Load(cfgPath)
	if err != nil {
		pipe = config.Default()
	}
	for _, ch := range changes {
		if ch.Type == ChangeAdd {
			pipe.Checks = append(pipe.Checks, config.Check{Name: ch.Suggestion})
		}
	}
	data, err := yaml.Marshal(pipe)
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}
	return os.WriteFile(cfgPath, data, 0644)
}
