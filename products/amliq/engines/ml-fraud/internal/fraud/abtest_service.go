package fraud

import (
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ABTestService defines the interface for managing model A/B tests.
type ABTestService interface {
	CreateABTest(config ABTestConfig) (*ABTestConfig, error)
	GetABTest(id string) (*ABTestConfig, error)
	GetActiveABTest() (*ABTestConfig, error)
	StopABTest(id string) (*ABTestResult, error)
	GetTrafficSplit() (modelAID string, modelBID string, splitPct int, err error)
}

// InMemoryABTestService provides in-memory A/B test management.
type InMemoryABTestService struct {
	mu        sync.RWMutex
	tests     map[string]ABTestConfig
	modelRepo ModelRepository
}

// NewInMemoryABTestService creates a new A/B test service.
func NewInMemoryABTestService(modelRepo ModelRepository) *InMemoryABTestService {
	return &InMemoryABTestService{
		tests:     make(map[string]ABTestConfig),
		modelRepo: modelRepo,
	}
}

// CreateABTest validates and creates a new A/B test. Only one test can be active.
func (s *InMemoryABTestService) CreateABTest(config ABTestConfig) (*ABTestConfig, error) {
	if err := ValidateABTestConfig(config); err != nil {
		return nil, err
	}

	// Verify both models exist
	if _, err := s.modelRepo.GetModel(config.ModelAID); err != nil {
		return nil, fmt.Errorf("model A not found: %s", config.ModelAID)
	}
	if _, err := s.modelRepo.GetModel(config.ModelBID); err != nil {
		return nil, fmt.Errorf("model B not found: %s", config.ModelBID)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	// Check for already-running test
	for _, t := range s.tests {
		if t.Status == ABTestStatusRunning {
			return nil, fmt.Errorf("an A/B test is already running: %s", t.ID)
		}
	}

	config.ID = uuid.New().String()
	config.Status = ABTestStatusRunning
	config.StartedAt = time.Now()
	config.CreatedAt = time.Now()
	s.tests[config.ID] = config
	return &config, nil
}

// GetABTest returns a test by ID.
func (s *InMemoryABTestService) GetABTest(id string) (*ABTestConfig, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	test, ok := s.tests[id]
	if !ok {
		return nil, fmt.Errorf("A/B test not found: %s", id)
	}
	return &test, nil
}

// GetActiveABTest returns the currently running A/B test, if any.
func (s *InMemoryABTestService) GetActiveABTest() (*ABTestConfig, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, t := range s.tests {
		if t.Status == ABTestStatusRunning {
			return &t, nil
		}
	}
	return nil, fmt.Errorf("no active A/B test")
}

// StopABTest ends the test and determines the winner based on F1 score.
func (s *InMemoryABTestService) StopABTest(id string) (*ABTestResult, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	test, ok := s.tests[id]
	if !ok {
		return nil, fmt.Errorf("A/B test not found: %s", id)
	}
	if test.Status != ABTestStatusRunning {
		return nil, fmt.Errorf("test is not running (status: %s)", test.Status)
	}

	// Get current model metrics
	modelA, err := s.modelRepo.GetModel(test.ModelAID)
	if err != nil {
		return nil, fmt.Errorf("failed to get model A: %w", err)
	}
	modelB, err := s.modelRepo.GetModel(test.ModelBID)
	if err != nil {
		return nil, fmt.Errorf("failed to get model B: %w", err)
	}

	// Determine winner by F1 score
	winner := test.ModelAID
	confidence := 0.0
	diff := modelA.Metrics.F1Score - modelB.Metrics.F1Score
	if diff < 0 {
		winner = test.ModelBID
		diff = -diff
	}
	if diff > 0 {
		confidence = diff / (modelA.Metrics.F1Score + modelB.Metrics.F1Score) * 2
		if confidence > 1 {
			confidence = 1
		}
	}

	now := time.Now()
	test.Status = ABTestStatusCompleted
	test.EndedAt = &now
	s.tests[id] = test

	return &ABTestResult{
		TestID:        id,
		ModelAMetrics: modelA.Metrics,
		ModelBMetrics: modelB.Metrics,
		Winner:        winner,
		Confidence:    confidence,
		CompletedAt:   now,
	}, nil
}

// GetTrafficSplit returns the current traffic split for routing decisions.
func (s *InMemoryABTestService) GetTrafficSplit() (string, string, int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, t := range s.tests {
		if t.Status == ABTestStatusRunning {
			return t.ModelAID, t.ModelBID, t.TrafficSplit, nil
		}
	}
	return "", "", 0, fmt.Errorf("no active A/B test for traffic split")
}
