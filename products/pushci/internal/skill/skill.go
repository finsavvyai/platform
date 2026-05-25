package skill

import (
	"fmt"
	"strings"
	"time"
)

// Category classifies a skill.
type Category string

const (
	CategoryTemplate Category = "templates"
	CategoryCheck    Category = "checks"
	CategoryDeploy   Category = "deploy"
	CategoryNotify   Category = "notify"
	CategorySecurity Category = "security"
	CategoryAI       Category = "ai"
)

// Skill represents an installable CI/CD skill.
type Skill struct {
	ID          string            `yaml:"id"          json:"id"`
	Name        string            `yaml:"name"        json:"name"`
	Description string            `yaml:"description" json:"description"`
	Version     string            `yaml:"version"     json:"version"`
	Category    Category          `yaml:"category"    json:"category"`
	Author      string            `yaml:"author"      json:"author"`
	Tags        []string          `yaml:"tags"        json:"tags"`
	Verified    bool              `yaml:"verified"    json:"verified"`
	Installs    int               `yaml:"installs"    json:"installs"`
	Steps       []Step            `yaml:"steps"       json:"steps"`
	Config      map[string]string `yaml:"config"      json:"config,omitempty"`
	CreatedAt   time.Time         `yaml:"-"           json:"created_at"`
}

// Step is a single execution step within a skill.
type Step struct {
	Name   string `yaml:"name"              json:"name"`
	Run    string `yaml:"run"               json:"run"`
	OnFail string `yaml:"on_fail,omitempty" json:"on_fail,omitempty"`
}

// Validate checks that a skill has required fields.
func (s *Skill) Validate() error {
	if s.ID == "" {
		return fmt.Errorf("skill id is required")
	}
	if s.Name == "" {
		return fmt.Errorf("skill name is required")
	}
	if s.Version == "" {
		return fmt.Errorf("skill version is required")
	}
	if len(s.Steps) == 0 {
		return fmt.Errorf("skill must have at least one step")
	}
	for i, step := range s.Steps {
		if step.Run == "" {
			return fmt.Errorf("step %d (%s) must have a run command", i, step.Name)
		}
	}
	return nil
}

// MatchesQuery checks if a skill matches a search query.
func (s *Skill) MatchesQuery(query string) bool {
	q := strings.ToLower(query)
	if strings.Contains(strings.ToLower(s.Name), q) {
		return true
	}
	if strings.Contains(strings.ToLower(s.Description), q) {
		return true
	}
	if strings.Contains(strings.ToLower(string(s.Category)), q) {
		return true
	}
	for _, tag := range s.Tags {
		if strings.Contains(strings.ToLower(tag), q) {
			return true
		}
	}
	return false
}
