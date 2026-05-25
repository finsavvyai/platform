package ingestion

import (
	"fmt"
	"sync"
)

// TypeRegistry maps parser type strings to Parser implementations.
type TypeRegistry struct {
	mu      sync.RWMutex
	parsers map[string]Parser
}

// NewTypeRegistry creates a new empty type-based registry.
func NewTypeRegistry() *TypeRegistry {
	return &TypeRegistry{
		parsers: make(map[string]Parser),
	}
}

// RegisterType associates a parser type string with a parser.
func (tr *TypeRegistry) RegisterType(parserType string, p Parser) error {
	tr.mu.Lock()
	defer tr.mu.Unlock()
	if p == nil {
		return fmt.Errorf("parser cannot be nil")
	}
	tr.parsers[parserType] = p
	return nil
}

// Get returns the parser for the given type string, or an error if
// no parser is registered under that type.
func (tr *TypeRegistry) Get(parserType string) (Parser, error) {
	tr.mu.RLock()
	defer tr.mu.RUnlock()
	if p, ok := tr.parsers[parserType]; ok {
		return p, nil
	}
	return nil, fmt.Errorf("no parser registered for type: %s", parserType)
}

// GetByType returns the parser for the given type string.
func (r *Registry) GetByType(parserType string) (Parser, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for source, parser := range r.parsers {
		if matchesType(source.String(), parserType) {
			return parser, nil
		}
	}
	return nil, fmt.Errorf("no parser for type: %s", parserType)
}

func matchesType(sourceName, parserType string) bool {
	for _, alias := range typeAliases[sourceName] {
		if alias == parserType {
			return true
		}
	}
	return false
}

// typeAliases maps each enum source name to every parser-type string
// that should resolve to the parser registered under that source.
var typeAliases = map[string][]string{
	"OFAC":          {"ofac", "ofac_advanced"},
	"EU":            {"eu"},
	"UN":            {"un"},
	"UKOFSI":        {"uk_ofsi"},
	"SECO":          {"swiss"},
	"IsraeliMoD":    {"israeli"},
	"Custom":        {"custom_csv"},
	"OpenSanctions": {"opensanctions", "opensanctions_nested"},
	"SDFM":          {"sdfm"},
	"DFAT":          {"au_dfat"},
	"Canada":        {"ca_osfi"},
	"Japan":         {"jp_mof"},
	"MAS":           {"sg_mas"},
	"Korea":         {"kr_kofiu"},
	"UAE":           {"ae_cbuae"},
	"India":         {"in_rbi"},
	"Brazil":        {"br_coaf"},
	"SouthAfrica":   {"za_fic"},
}
