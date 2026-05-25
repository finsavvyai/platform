package compliance

import "errors"

// Sentinel errors for registry lookups.
var (
	ErrFrameworkNotFound = errors.New("compliance framework not found")
	ErrControlNotFound   = errors.New("control not found")
)

// EvidenceSource describes where evidence for a control can be gathered.
type EvidenceSource struct {
	Type            EvidenceType `json:"type"`
	Description     string       `json:"description"`
	AutoCollectable bool         `json:"auto_collectable"`
}

// ControlDefinition pairs a control with its evidence sources and
// a confidence score indicating how reliably it can be auto-verified.
type ControlDefinition struct {
	Control         Control          `json:"control"`
	EvidenceSources []EvidenceSource `json:"evidence_sources"`
	Confidence      float64          `json:"confidence"`
}

// ControlRegistry provides read access to known compliance controls.
type ControlRegistry interface {
	GetControls(framework ComplianceFramework) ([]ControlDefinition, error)
	GetControl(controlID string) (*ControlDefinition, error)
	ListFrameworks() []ComplianceFramework
}

// InMemoryControlRegistry stores control definitions in memory.
type InMemoryControlRegistry struct {
	controls map[string]*ControlDefinition
}

// NewInMemoryControlRegistry creates a registry pre-loaded with
// SOC 2 and PCI DSS control definitions.
func NewInMemoryControlRegistry() *InMemoryControlRegistry {
	r := &InMemoryControlRegistry{
		controls: make(map[string]*ControlDefinition),
	}
	initSOC2Controls(r)
	initPCIDSSControls(r)
	return r
}

// register adds a control definition to the registry.
func (r *InMemoryControlRegistry) register(def *ControlDefinition) {
	r.controls[def.Control.ID] = def
}

// GetControls returns all controls for the given framework.
func (r *InMemoryControlRegistry) GetControls(
	fw ComplianceFramework,
) ([]ControlDefinition, error) {
	var results []ControlDefinition
	for _, def := range r.controls {
		if def.Control.Framework == fw {
			results = append(results, *def)
		}
	}
	if len(results) == 0 {
		return nil, ErrFrameworkNotFound
	}
	return results, nil
}

// GetControl returns a single control by its ID.
func (r *InMemoryControlRegistry) GetControl(
	controlID string,
) (*ControlDefinition, error) {
	def, ok := r.controls[controlID]
	if !ok {
		return nil, ErrControlNotFound
	}
	cp := *def
	return &cp, nil
}

// ListFrameworks returns the distinct frameworks in the registry.
func (r *InMemoryControlRegistry) ListFrameworks() []ComplianceFramework {
	seen := make(map[ComplianceFramework]bool)
	var frameworks []ComplianceFramework
	for _, def := range r.controls {
		fw := def.Control.Framework
		if !seen[fw] {
			seen[fw] = true
			frameworks = append(frameworks, fw)
		}
	}
	return frameworks
}
