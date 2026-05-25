package fraud

import (
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ModelRepository defines the interface for model version management.
type ModelRepository interface {
	ListModels(offset, limit int, statusFilter string) ([]ModelVersion, int, error)
	GetModel(id string) (*ModelVersion, error)
	CreateModel(model ModelVersion) (*ModelVersion, error)
	UpdateModelStatus(id string, status ModelStatus) error
	GetActiveModel() (*ModelVersion, error)
	CompareModels(idA, idB string) (*ModelComparison, error)
}

// InMemoryModelRepository stores model versions in memory.
type InMemoryModelRepository struct {
	mu     sync.RWMutex
	models map[string]ModelVersion
}

// NewInMemoryModelRepository creates a new in-memory model repository.
func NewInMemoryModelRepository() *InMemoryModelRepository {
	return &InMemoryModelRepository{
		models: make(map[string]ModelVersion),
	}
}

// ListModels returns paginated model versions, optionally filtered by status.
func (r *InMemoryModelRepository) ListModels(offset, limit int, statusFilter string) ([]ModelVersion, int, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var filtered []ModelVersion
	for _, m := range r.models {
		if statusFilter != "" && string(m.Status) != statusFilter {
			continue
		}
		filtered = append(filtered, m)
	}

	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].CreatedAt.After(filtered[j].CreatedAt)
	})

	total := len(filtered)
	if offset >= total {
		return []ModelVersion{}, total, nil
	}
	end := offset + limit
	if end > total {
		end = total
	}
	return filtered[offset:end], total, nil
}

// GetModel returns a single model version by ID.
func (r *InMemoryModelRepository) GetModel(id string) (*ModelVersion, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	model, ok := r.models[id]
	if !ok {
		return nil, fmt.Errorf("model not found: %s", id)
	}
	return &model, nil
}

// CreateModel registers a new model version.
func (r *InMemoryModelRepository) CreateModel(model ModelVersion) (*ModelVersion, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if model.Name == "" || model.Algorithm == "" || model.Version == "" {
		return nil, fmt.Errorf("name, algorithm, and version are required")
	}
	model.ID = uuid.New().String()
	model.Status = ModelStatusInactive
	model.CreatedAt = time.Now()
	model.UpdatedAt = time.Now()
	r.models[model.ID] = model
	return &model, nil
}

// UpdateModelStatus changes a model's status. Only one model can be active.
func (r *InMemoryModelRepository) UpdateModelStatus(id string, status ModelStatus) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	model, ok := r.models[id]
	if !ok {
		return fmt.Errorf("model not found: %s", id)
	}

	// Deactivate current active model if activating a new one
	if status == ModelStatusActive {
		for k, m := range r.models {
			if m.Status == ModelStatusActive && k != id {
				m.Status = ModelStatusInactive
				m.UpdatedAt = time.Now()
				r.models[k] = m
			}
		}
	}

	model.Status = status
	model.UpdatedAt = time.Now()
	r.models[id] = model
	return nil
}

// GetActiveModel returns the currently active model version.
func (r *InMemoryModelRepository) GetActiveModel() (*ModelVersion, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, m := range r.models {
		if m.Status == ModelStatusActive {
			return &m, nil
		}
	}
	return nil, fmt.Errorf("no active model found")
}

// CompareModels returns a side-by-side comparison of two model versions.
func (r *InMemoryModelRepository) CompareModels(idA, idB string) (*ModelComparison, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	a, okA := r.models[idA]
	b, okB := r.models[idB]
	if !okA {
		return nil, fmt.Errorf("model A not found: %s", idA)
	}
	if !okB {
		return nil, fmt.Errorf("model B not found: %s", idB)
	}

	winner := "tie"
	if a.Metrics.F1Score > b.Metrics.F1Score {
		winner = a.ID
	} else if b.Metrics.F1Score > a.Metrics.F1Score {
		winner = b.ID
	}

	return &ModelComparison{
		ModelA:  a,
		ModelB:  b,
		Summary: fmt.Sprintf("F1 comparison: %s wins", winner),
	}, nil
}
