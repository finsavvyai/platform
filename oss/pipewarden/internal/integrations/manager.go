package integrations

import (
	"fmt"
	"slices"
	"sync"

	"github.com/finsavvyai/pipewarden/internal/logging"
)

// Manager orchestrates multiple named CI/CD platform connections.
// Users can add many connections — multiple GitHub orgs, multiple GitLab instances, etc.
type Manager struct {
	connections map[string]*Connection
	logger      *logging.Logger
	mu          sync.RWMutex
}

// NewManager creates a new integration manager.
func NewManager(logger *logging.Logger) *Manager {
	return &Manager{
		connections: make(map[string]*Connection),
		logger:      logger,
	}
}

// Add registers a named connection. Returns an error if the name is already taken.
func (m *Manager) Add(name string, provider Provider) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.connections[name]; exists {
		return fmt.Errorf("connection %q already exists", name)
	}

	m.connections[name] = &Connection{
		Name:     name,
		Platform: provider.Name(),
		Provider: provider,
	}
	m.logger.Infow("Added connection", "name", name, "platform", provider.Name())
	return nil
}

// Replace updates an existing connection or creates it if it doesn't exist.
func (m *Manager) Replace(name string, provider Provider) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.connections[name] = &Connection{
		Name:     name,
		Platform: provider.Name(),
		Provider: provider,
	}
	m.logger.Infow("Replaced connection", "name", name, "platform", provider.Name())
}

// Remove deletes a connection by name. Returns an error if not found.
func (m *Manager) Remove(name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.connections[name]; !exists {
		return fmt.Errorf("connection %q not found", name)
	}

	delete(m.connections, name)
	m.logger.Infow("Removed connection", "name", name)
	return nil
}

// Get returns a connection by name.
func (m *Manager) Get(name string) (*Connection, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	conn, ok := m.connections[name]
	if !ok {
		return nil, fmt.Errorf("connection %q not found", name)
	}
	return conn, nil
}

// GetByPlatform returns all connections for a given platform type.
func (m *Manager) GetByPlatform(platform Platform) []*Connection {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var result []*Connection
	for _, conn := range m.connections {
		if conn.Platform == platform {
			result = append(result, conn)
		}
	}
	return result
}

// List returns all registered connections.
func (m *Manager) List() []*Connection {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]*Connection, 0, len(m.connections))
	for _, conn := range m.connections {
		result = append(result, conn)
	}
	slices.SortFunc(result, func(a, b *Connection) int {
		switch {
		case a.Name < b.Name:
			return -1
		case a.Name > b.Name:
			return 1
		default:
			return 0
		}
	})
	return result
}

// Count returns the total number of connections.
func (m *Manager) Count() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.connections)
}

func cloneConnectionStatus(status *ConnectionStatus) *ConnectionStatus {
	if status == nil {
		return &ConnectionStatus{}
	}

	cloned := *status
	if status.Scopes != nil {
		cloned.Scopes = append([]string(nil), status.Scopes...)
	}
	return &cloned
}
