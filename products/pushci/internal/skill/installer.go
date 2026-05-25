package skill

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

// Installer manages installing skills into a project.
type Installer struct {
	registry *Registry
}

// NewInstaller creates a skill installer.
func NewInstaller(reg *Registry) *Installer {
	return &Installer{registry: reg}
}

// Install adds a skill's steps to a project's pushci.yml.
func (inst *Installer) Install(skillID, projectDir string) error {
	s, ok := inst.registry.Get(skillID)
	if !ok {
		return fmt.Errorf("skill %q not found", skillID)
	}
	return inst.writeSkillConfig(s, projectDir)
}

// Uninstall removes a skill's configuration from a project.
func (inst *Installer) Uninstall(skillID, projectDir string) error {
	skillDir := filepath.Join(projectDir, ".pushci", "skills")
	path := filepath.Join(skillDir, skillID+".yml")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return fmt.Errorf("skill %q is not installed", skillID)
	}
	return os.Remove(path)
}

// ListInstalled returns IDs of skills installed in a project.
func (inst *Installer) ListInstalled(projectDir string) ([]string, error) {
	skillDir := filepath.Join(projectDir, ".pushci", "skills")
	entries, err := os.ReadDir(skillDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var ids []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".yml") {
			ids = append(ids, strings.TrimSuffix(e.Name(), ".yml"))
		}
	}
	return ids, nil
}

// IsInstalled checks if a skill is installed in a project.
func (inst *Installer) IsInstalled(skillID, projectDir string) bool {
	path := filepath.Join(projectDir, ".pushci", "skills", skillID+".yml")
	_, err := os.Stat(path)
	return err == nil
}

func (inst *Installer) writeSkillConfig(s *Skill, projectDir string) error {
	skillDir := filepath.Join(projectDir, ".pushci", "skills")
	if err := os.MkdirAll(skillDir, 0755); err != nil {
		return fmt.Errorf("create skills dir: %w", err)
	}
	data, err := yaml.Marshal(s)
	if err != nil {
		return fmt.Errorf("marshal skill: %w", err)
	}
	path := filepath.Join(skillDir, s.ID+".yml")
	return os.WriteFile(path, data, 0644)
}
