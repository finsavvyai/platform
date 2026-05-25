package ingestion

import (
	"fmt"
	"sync"

	"github.com/aegis-aml/aegis/internal/domain"
)

type Registry struct {
	mu      sync.RWMutex
	parsers map[domain.ListSource]Parser
}

func NewRegistry() *Registry {
	return &Registry{
		parsers: make(map[domain.ListSource]Parser),
	}
}

func (r *Registry) Register(source domain.ListSource, parser Parser) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if parser == nil {
		return fmt.Errorf("parser cannot be nil")
	}
	r.parsers[source] = parser
	return nil
}

func (r *Registry) Get(source domain.ListSource) (Parser, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	parser, exists := r.parsers[source]
	if !exists {
		return nil, fmt.Errorf("no parser for source: %s", source.String())
	}
	return parser, nil
}
