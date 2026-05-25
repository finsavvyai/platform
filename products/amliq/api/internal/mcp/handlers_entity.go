package mcp

import (
	"encoding/json"
	"fmt"

	"github.com/aegis-aml/aegis/internal/screening"
)

func (s *Server) handleGetEntity(params json.RawMessage) (interface{}, error) {
	var p struct {
		EntityID string `json:"entity_id"`
	}
	if err := json.Unmarshal(params, &p); err != nil {
		return nil, fmt.Errorf("bad params: %w", err)
	}
	if s.index == nil {
		return nil, fmt.Errorf("search index not available")
	}
	hits := s.index.Search(p.EntityID, screening.SearchOpts{Limit: 1})
	if len(hits) == 0 {
		return nil, fmt.Errorf("entity not found: %s", p.EntityID)
	}
	ent := hits[0].Entity
	aliases := make([]string, len(ent.Names))
	for i, n := range ent.Names {
		aliases[i] = n.Full
	}
	return map[string]interface{}{
		"name": ent.PrimaryName().Full, "list": ent.ListID,
		"type": ent.Type.String(), "aliases": aliases,
		"metadata": ent.Metadata,
	}, nil
}
