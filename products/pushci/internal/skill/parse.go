package skill

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// ParseSkillFile reads a skill YAML definition from a file.
func ParseSkillFile(path string) (*Skill, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read skill file: %w", err)
	}
	return ParseSkill(data)
}

// ParseSkill parses YAML bytes into a Skill.
func ParseSkill(data []byte) (*Skill, error) {
	var s Skill
	if err := yaml.Unmarshal(data, &s); err != nil {
		return nil, fmt.Errorf("parse skill yaml: %w", err)
	}
	if err := s.Validate(); err != nil {
		return nil, err
	}
	return &s, nil
}
