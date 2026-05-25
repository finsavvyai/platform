package skill

import (
	"bytes"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"gopkg.in/yaml.v3"
)

// TelemetryAPIBase is overridable by tests. Production defaults to the
// public API host. Used only when PUSHCI_TELEMETRY_ENABLED=1 and a token
// is present in ~/.pushci/config.json.
var TelemetryAPIBase = "https://api.pushci.dev"

// ReportInvocation best-effort POSTs a single skill invocation event to
// the marketplace. Never blocks the caller: short timeout, errors are
// swallowed. Opt-in: requires PUSHCI_TELEMETRY_ENABLED=1 and a bearer
// token.
func ReportInvocation(skillID, token string) {
	if os.Getenv("PUSHCI_TELEMETRY_ENABLED") != "1" || token == "" || skillID == "" {
		return
	}
	go func(id, tok string) {
		url := fmt.Sprintf("%s/api/skills/%s/events/invoke", TelemetryAPIBase, id)
		req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader([]byte("{}")))
		if err != nil {
			return
		}
		req.Header.Set("Authorization", "Bearer "+tok)
		req.Header.Set("Content-Type", "application/json")
		client := &http.Client{Timeout: 2 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			return
		}
		_ = resp.Body.Close()
	}(skillID, token)
}

// InstalledStep represents a runnable command from an installed skill.
type InstalledStep struct {
	SkillID   string
	SkillName string
	StepName  string
	Command   string
	OnFail    string // "block" or empty
}

// LoadInstalledSteps reads all installed skill YAML files and returns
// their steps as executable commands. Called by `pushci run` to merge
// skill steps into the pipeline.
func LoadInstalledSteps(projectDir string) ([]InstalledStep, error) {
	skillDir := filepath.Join(projectDir, ".pushci", "skills")
	entries, err := os.ReadDir(skillDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var allSteps []InstalledStep
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".yml" {
			continue
		}
		path := filepath.Join(skillDir, e.Name())
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}

		var s Skill
		if err := yaml.Unmarshal(data, &s); err != nil {
			continue
		}

		for _, step := range s.Steps {
			allSteps = append(allSteps, InstalledStep{
				SkillID:   s.ID,
				SkillName: s.Name,
				StepName:  step.Name,
				Command:   step.Run,
				OnFail:    step.OnFail,
			})
		}
	}
	return allSteps, nil
}

// FormatStepLabel returns a display label for a skill step.
func (s InstalledStep) FormatStepLabel() string {
	return fmt.Sprintf("[%s] %s", s.SkillName, s.StepName)
}
