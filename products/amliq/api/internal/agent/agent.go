package agent

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/screening"
)

// AgentConfig holds on-premise agent settings.
type AgentConfig struct {
	ListUpdateURL string
	SyncInterval  time.Duration
	DataDir       string
	WorkerCount   int
	APIToken      string
}

// Agent is a privacy-preserving on-premise screening agent.
type Agent struct {
	SearchIndex *screening.SearchIndex
	Engine      *screening.Engine
	config      AgentConfig
	httpClient  *http.Client
	entities    []domain.Entity
	lastSync    time.Time
}

// NewAgent creates a new on-premise agent with the given config.
func NewAgent(cfg AgentConfig) *Agent {
	if cfg.WorkerCount <= 0 {
		cfg.WorkerCount = 4
	}
	idx := screening.NewSearchIndex()
	engine := screening.NewEngine(nil, screening.WithSearchIndex(idx))
	return &Agent{
		SearchIndex: idx,
		Engine:      engine,
		config:      cfg,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Start downloads the latest lists, builds the index, and readies the agent.
func (a *Agent) Start(ctx context.Context) error {
	entities, err := a.fetchLists(ctx)
	if err != nil {
		return fmt.Errorf("fetch lists: %w", err)
	}
	a.entities = entities
	a.SearchIndex.Load(entities)
	a.lastSync = time.Now().UTC()
	log.Printf("agent ready: %d entities indexed", len(entities))
	return nil
}

// Entities returns the currently loaded entity list.
func (a *Agent) Entities() []domain.Entity {
	return a.entities
}

// Config returns the agent configuration.
func (a *Agent) Config() AgentConfig {
	return a.config
}

// LastSync returns the timestamp of the last successful list sync.
func (a *Agent) LastSync() time.Time {
	return a.lastSync
}

// fetchLists downloads the latest sanctions list from the cloud endpoint.
func (a *Agent) fetchLists(ctx context.Context) ([]domain.Entity, error) {
	if a.config.ListUpdateURL == "" {
		return nil, fmt.Errorf("list update URL not configured")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, a.config.ListUpdateURL, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	if a.config.APIToken != "" {
		req.Header.Set("Authorization", "Bearer "+a.config.APIToken)
	}
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http get: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}
	// In production, decode JSON entity list from response body.
	return nil, nil
}
