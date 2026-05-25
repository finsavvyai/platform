package plugin

import (
	"context"
	"sync"
	"time"

	"github.com/finsavvyai/pushci/internal/config"
)

// Result holds the outcome of a plugin execution.
type Result struct {
	Passed   bool
	Output   string
	Duration time.Duration
}

// Plugin defines a CI check that can be executed.
type Plugin interface {
	Name() string
	Run(ctx context.Context, dir string) (*Result, error)
}

// Registry stores plugins by name.
type Registry struct {
	mu      sync.RWMutex
	plugins map[string]Plugin
}

// NewRegistry creates an empty plugin registry.
func NewRegistry() *Registry {
	return &Registry{plugins: make(map[string]Plugin)}
}

// Register adds a plugin to the registry.
func (r *Registry) Register(name string, p Plugin) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.plugins[name] = p
}

// Get retrieves a plugin by name, or nil if not found.
func (r *Registry) Get(name string) Plugin {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.plugins[name]
}

// All returns all registered plugin names.
func (r *Registry) All() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	names := make([]string, 0, len(r.plugins))
	for n := range r.plugins {
		names = append(names, n)
	}
	return names
}

// LoadFromConfig maps check configs to plugins.
func LoadFromConfig(reg *Registry, checks []config.Check) []Plugin {
	var plugins []Plugin
	for _, c := range checks {
		switch {
		case c.Run != "":
			plugins = append(plugins, &ScriptPlugin{
				PluginName: c.Name, Command: c.Run,
			})
		case c.Docker != "":
			plugins = append(plugins, &DockerPlugin{
				PluginName: c.Name, Image: c.Docker,
			})
		default:
			if p := reg.Get(c.Name); p != nil {
				plugins = append(plugins, p)
			}
		}
	}
	return plugins
}
