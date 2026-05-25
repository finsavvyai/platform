package skill

import "sync"

// Registry holds all available skills.
type Registry struct {
	mu     sync.RWMutex
	skills map[string]*Skill
}

// NewRegistry creates an empty skill registry.
func NewRegistry() *Registry {
	return &Registry{skills: make(map[string]*Skill)}
}

// Register adds a skill to the registry.
func (r *Registry) Register(s *Skill) error {
	if err := s.Validate(); err != nil {
		return err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.skills[s.ID] = s
	return nil
}

// Get retrieves a skill by ID.
func (r *Registry) Get(id string) (*Skill, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	s, ok := r.skills[id]
	return s, ok
}

// List returns all registered skills.
func (r *Registry) List() []*Skill {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]*Skill, 0, len(r.skills))
	for _, s := range r.skills {
		out = append(out, s)
	}
	return out
}

// Search returns skills matching the query string.
func (r *Registry) Search(query string) []*Skill {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var results []*Skill
	for _, s := range r.skills {
		if s.MatchesQuery(query) {
			results = append(results, s)
		}
	}
	return results
}

// ListByCategory returns all skills for a given category.
func (r *Registry) ListByCategory(cat Category) []*Skill {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var results []*Skill
	for _, s := range r.skills {
		if s.Category == cat {
			results = append(results, s)
		}
	}
	return results
}

// Remove deletes a skill from the registry.
func (r *Registry) Remove(id string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	_, ok := r.skills[id]
	if ok {
		delete(r.skills, id)
	}
	return ok
}

// Count returns the total number of skills.
func (r *Registry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.skills)
}
