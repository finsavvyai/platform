package templates

import "time"

// Template represents a reusable pipeline template.
type Template struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Author      string            `json:"author"`
	Version     string            `json:"version"`
	Tags        []string          `json:"tags"`
	Stack       string            `json:"stack"`
	YAML        string            `json:"yaml"`
	Vars        map[string]string `json:"vars"`
	Downloads   int               `json:"downloads"`
	Rating      float64           `json:"rating"`
	CreatedAt   time.Time         `json:"created_at"`
	Public      bool              `json:"public"`
	Price       float64           `json:"price"`
}

// Registry manages pipeline templates.
type Registry struct {
	templates map[string]*Template
}

// NewRegistry creates a template registry.
func NewRegistry() *Registry {
	r := &Registry{templates: make(map[string]*Template)}
	r.loadBuiltins()
	return r
}

// Get returns a template by ID.
func (r *Registry) Get(id string) (*Template, bool) {
	t, ok := r.templates[id]
	return t, ok
}

// Search returns templates matching the query.
func (r *Registry) Search(query string) []*Template {
	var results []*Template
	for _, t := range r.templates {
		if matchesQuery(t, query) && t.Public {
			results = append(results, t)
		}
	}
	return results
}

// Publish adds a template to the registry.
func (r *Registry) Publish(t *Template) {
	r.templates[t.ID] = t
}

// ListByStack returns all templates for a given stack.
func (r *Registry) ListByStack(stack string) []*Template {
	var results []*Template
	for _, t := range r.templates {
		if t.Stack == stack && t.Public {
			results = append(results, t)
		}
	}
	return results
}
