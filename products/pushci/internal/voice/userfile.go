package voice

import (
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// userPersonasPath is overridable via env var so users can keep
// per-project persona libraries; defaults to ~/.pushci/voices.yml
// (Apple HIG'ish: hidden config directory under home).
func userPersonasPath() string {
	if p := os.Getenv("PUSHCI_VOICE_FILE"); p != "" {
		return p
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, ".pushci", "voices.yml")
}

// userVoicesFile is the on-disk shape — a flat list of personas
// authored by the user (or fetched by a future `pushci voice install`).
// Schema is intentionally identical to the in-memory Persona so a
// well-formed file maps 1:1.
type userVoicesFile struct {
	Personas []userPersona `yaml:"personas"`
}

type userPersona struct {
	Name        string              `yaml:"name"`
	Voice       string              `yaml:"voice"`
	Description string              `yaml:"description"`
	Phrases     map[string][]string `yaml:"phrases"`
}

// LoadUserPersonas reads the user-config file and returns valid
// Persona entries. Silent on missing file; surfaces parse errors
// only in tests / strict callers. Invalid entries (missing name
// or empty phrases map) are dropped without erroring so a typo
// doesn't break the whole CLI.
func LoadUserPersonas() []Persona {
	path := userPersonasPath()
	if path == "" {
		return nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var file userVoicesFile
	if yaml.Unmarshal(data, &file) != nil {
		return nil
	}
	return convertUserPersonas(file.Personas)
}

func convertUserPersonas(in []userPersona) []Persona {
	out := make([]Persona, 0, len(in))
	for _, u := range in {
		if u.Name == "" || len(u.Phrases) == 0 {
			continue
		}
		p := Persona{
			Name:        u.Name,
			VoiceID:     u.Voice,
			Description: u.Description,
			Phrases:     map[Event][]string{},
		}
		for k, v := range u.Phrases {
			if len(v) == 0 {
				continue
			}
			p.Phrases[Event(k)] = v
		}
		out = append(out, p)
	}
	return out
}
