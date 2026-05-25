package integrations

import (
	"context"
	"fmt"
	"sync"
)

// TestConnection tests a single named connection.
func (m *Manager) TestConnection(ctx context.Context, name string) (*ConnectionStatus, error) {
	m.mu.RLock()
	conn, ok := m.connections[name]
	m.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("connection %q not found", name)
	}

	status, err := conn.Provider.TestConnection(ctx)
	if err != nil {
		return &ConnectionStatus{
			Connected:      false,
			Platform:       conn.Platform,
			ConnectionName: name,
			Message:        err.Error(),
		}, nil
	}

	status = cloneConnectionStatus(status)
	status.ConnectionName = name
	return status, nil
}

// TestAllConnections tests connectivity for every registered connection concurrently.
func (m *Manager) TestAllConnections(ctx context.Context) map[string]*ConnectionStatus {
	m.mu.RLock()
	snapshot := make(map[string]*Connection, len(m.connections))
	for k, v := range m.connections {
		snapshot[k] = v
	}
	m.mu.RUnlock()

	results := make(map[string]*ConnectionStatus, len(snapshot))
	var mu sync.Mutex
	var wg sync.WaitGroup

	for name, conn := range snapshot {
		wg.Add(1)
		go func(n string, c *Connection) {
			defer wg.Done()
			status, err := c.Provider.TestConnection(ctx)
			if err != nil {
				m.logger.Errorw("Connection test failed", "name", n, "platform", c.Platform, "error", err)
				status = &ConnectionStatus{
					Connected:      false,
					Platform:       c.Platform,
					ConnectionName: n,
					Message:        err.Error(),
				}
			} else {
				status = cloneConnectionStatus(status)
				status.ConnectionName = n
			}
			mu.Lock()
			results[n] = status
			mu.Unlock()
		}(name, conn)
	}

	wg.Wait()
	return results
}

// TestByPlatform tests all connections for a given platform type concurrently.
func (m *Manager) TestByPlatform(ctx context.Context, platform Platform) map[string]*ConnectionStatus {
	conns := m.GetByPlatform(platform)

	results := make(map[string]*ConnectionStatus, len(conns))
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, conn := range conns {
		wg.Add(1)
		go func(c *Connection) {
			defer wg.Done()
			status, err := c.Provider.TestConnection(ctx)
			if err != nil {
				status = &ConnectionStatus{
					Connected:      false,
					Platform:       c.Platform,
					ConnectionName: c.Name,
					Message:        err.Error(),
				}
			} else {
				status = cloneConnectionStatus(status)
				status.ConnectionName = c.Name
			}
			mu.Lock()
			results[c.Name] = status
			mu.Unlock()
		}(conn)
	}

	wg.Wait()
	return results
}

// ListPipelines proxies a pipeline list request to a named connection.
func (m *Manager) ListPipelines(ctx context.Context, name, owner, repo string) ([]Pipeline, error) {
	conn, err := m.Get(name)
	if err != nil {
		return nil, err
	}
	return conn.Provider.ListPipelines(ctx, owner, repo)
}

// GetPipelineRun proxies a single run lookup to a named connection.
func (m *Manager) GetPipelineRun(ctx context.Context, name, owner, repo, runID string) (*PipelineRun, error) {
	conn, err := m.Get(name)
	if err != nil {
		return nil, err
	}
	return conn.Provider.GetPipelineRun(ctx, owner, repo, runID)
}

// ListPipelineRuns proxies a run list request to a named connection.
func (m *Manager) ListPipelineRuns(ctx context.Context, name, owner, repo string, limit int) ([]PipelineRun, error) {
	conn, err := m.Get(name)
	if err != nil {
		return nil, err
	}
	return conn.Provider.ListPipelineRuns(ctx, owner, repo, limit)
}

// TriggerPipeline proxies a trigger request to a named connection.
func (m *Manager) TriggerPipeline(ctx context.Context, name, owner, repo, workflow, branch string) (*PipelineRun, error) {
	conn, err := m.Get(name)
	if err != nil {
		return nil, err
	}
	return conn.Provider.TriggerPipeline(ctx, owner, repo, workflow, branch)
}
