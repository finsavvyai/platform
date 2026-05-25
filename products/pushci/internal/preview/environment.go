package preview

import (
	"fmt"
	"time"
)

// Environment represents a deployed preview for a PR.
type Environment struct {
	ID        string    `json:"id"`
	PRID      int       `json:"pr_id"`
	Branch    string    `json:"branch"`
	URL       string    `json:"url"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
	Repo      string    `json:"repo"`
}

// Manager handles preview environment lifecycle.
type Manager struct {
	envs    map[string]*Environment
	baseURL string
}

// NewManager creates a preview environment manager.
func NewManager(baseURL string) *Manager {
	return &Manager{envs: make(map[string]*Environment), baseURL: baseURL}
}

// Deploy creates a preview environment for a PR.
func (m *Manager) Deploy(repo, branch string, prID int) (*Environment, error) {
	id := fmt.Sprintf("preview-%s-%d", branch, prID)
	env := &Environment{
		ID: id, PRID: prID, Branch: branch,
		URL:       fmt.Sprintf("%s/%s", m.baseURL, id),
		Status:    "active",
		CreatedAt: time.Now(),
		ExpiresAt: time.Now().Add(24 * time.Hour),
		Repo:      repo,
	}
	m.envs[id] = env
	return env, nil
}

// Destroy tears down a preview environment.
func (m *Manager) Destroy(id string) error {
	if _, ok := m.envs[id]; !ok {
		return fmt.Errorf("preview %s not found", id)
	}
	delete(m.envs, id)
	return nil
}

// Get returns a preview environment by ID.
func (m *Manager) Get(id string) (*Environment, bool) {
	env, ok := m.envs[id]
	return env, ok
}

// ListActive returns all active preview environments.
func (m *Manager) ListActive() []*Environment {
	var active []*Environment
	for _, env := range m.envs {
		if env.Status == "active" {
			active = append(active, env)
		}
	}
	return active
}

// Promote promotes a preview to production.
func (m *Manager) Promote(id string) (*Environment, error) {
	env, ok := m.envs[id]
	if !ok {
		return nil, fmt.Errorf("preview %s not found", id)
	}
	env.Status = "promoted"
	return env, nil
}

// Cleanup destroys expired preview environments.
func (m *Manager) Cleanup() int {
	var expired []string
	now := time.Now()
	for id, env := range m.envs {
		if env.ExpiresAt.Before(now) {
			expired = append(expired, id)
		}
	}
	for _, id := range expired {
		_ = m.Destroy(id)
	}
	return len(expired)
}
