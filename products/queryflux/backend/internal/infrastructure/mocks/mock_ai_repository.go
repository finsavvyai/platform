package mocks

import (
	"context"
	"sync"

	"github.com/queryflux/backend/internal/application/ports"
	"github.com/queryflux/backend/internal/domain"
)

// MockAIRepository implements AIRepository for testing
type MockAIRepository struct {
	configs      map[domain.AIService]*domain.AIConfig
	requests     map[string]*domain.AIRequest
	responses    map[string]*domain.AIResponse
	nlRequests   map[string]*domain.NLToSQLRequest
	nlResponses  map[string]*domain.NLToSQLResponse
	optRequests  map[string]*domain.QueryOptimizationRequest
	optResponses map[string]*domain.QueryOptimizationResponse
	expRequests  map[string]*domain.QueryExplanationRequest
	expResponses map[string]*domain.QueryExplanationResponse
	usages       map[string][]*domain.AIUsage
	templates    map[string]*domain.AIPromptTemplate
	mu           sync.RWMutex
}

func NewMockAIRepository() *MockAIRepository {
	return &MockAIRepository{
		configs:      make(map[domain.AIService]*domain.AIConfig),
		requests:     make(map[string]*domain.AIRequest),
		responses:    make(map[string]*domain.AIResponse),
		nlRequests:   make(map[string]*domain.NLToSQLRequest),
		nlResponses:  make(map[string]*domain.NLToSQLResponse),
		optRequests:  make(map[string]*domain.QueryOptimizationRequest),
		optResponses: make(map[string]*domain.QueryOptimizationResponse),
		expRequests:  make(map[string]*domain.QueryExplanationRequest),
		expResponses: make(map[string]*domain.QueryExplanationResponse),
		usages:       make(map[string][]*domain.AIUsage),
		templates:    make(map[string]*domain.AIPromptTemplate),
	}
}

func (m *MockAIRepository) CreateAIConfig(ctx context.Context, config *domain.AIConfig) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.configs[config.Service] = config
	return nil
}

func (m *MockAIRepository) GetAIConfig(ctx context.Context, service domain.AIService) (*domain.AIConfig, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if config, ok := m.configs[service]; ok {
		return config, nil
	}
	return nil, ports.ErrNotFound
}

func (m *MockAIRepository) UpdateAIConfig(ctx context.Context, config *domain.AIConfig) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.configs[config.Service] = config
	return nil
}

func (m *MockAIRepository) DeleteAIConfig(ctx context.Context, service domain.AIService) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.configs, service)
	return nil
}

func (m *MockAIRepository) ListAIConfigs(ctx context.Context) ([]*domain.AIConfig, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var configs []*domain.AIConfig
	for _, config := range m.configs {
		configs = append(configs, config)
	}
	return configs, nil
}

func (m *MockAIRepository) CreateAIRequest(ctx context.Context, request *domain.AIRequest) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.requests[request.ID] = request
	return nil
}

func (m *MockAIRepository) GetAIRequest(ctx context.Context, id string) (*domain.AIRequest, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if request, ok := m.requests[id]; ok {
		return request, nil
	}
	return nil, ports.ErrNotFound
}

func (m *MockAIRepository) CreateAIResponse(ctx context.Context, response *domain.AIResponse) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.responses[response.ID] = response
	return nil
}

func (m *MockAIRepository) GetAIResponse(ctx context.Context, id string) (*domain.AIResponse, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if response, ok := m.responses[id]; ok {
		return response, nil
	}
	return nil, ports.ErrNotFound
}

func (m *MockAIRepository) ListAIRequests(ctx context.Context, userID string, limit, offset int) ([]*domain.AIRequest, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var requests []*domain.AIRequest
	for _, request := range m.requests {
		if request.UserID == userID {
			requests = append(requests, request)
		}
	}
	if offset >= len(requests) {
		return nil, nil
	}
	if offset+limit > len(requests) {
		requests = requests[offset:]
	} else {
		requests = requests[offset : offset+limit]
	}
	return requests, nil
}

func (m *MockAIRepository) ListAIResponses(ctx context.Context, userID string, limit, offset int) ([]*domain.AIResponse, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var responses []*domain.AIResponse
	for _, response := range m.responses {
		responses = append(responses, response)
	}
	if offset >= len(responses) {
		return nil, nil
	}
	if offset+limit > len(responses) {
		responses = responses[offset:]
	} else {
		responses = responses[offset : offset+limit]
	}
	return responses, nil
}

func (m *MockAIRepository) CreateNLToSQLRequest(ctx context.Context, request *domain.NLToSQLRequest) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.nlRequests[request.ID] = request
	return nil
}

func (m *MockAIRepository) GetNLToSQLRequest(ctx context.Context, id string) (*domain.NLToSQLRequest, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if request, ok := m.nlRequests[id]; ok {
		return request, nil
	}
	return nil, ports.ErrNotFound
}

func (m *MockAIRepository) CreateNLToSQLResponse(ctx context.Context, response *domain.NLToSQLResponse) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.nlResponses[response.ID] = response
	return nil
}

func (m *MockAIRepository) GetNLToSQLResponse(ctx context.Context, id string) (*domain.NLToSQLResponse, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if response, ok := m.nlResponses[id]; ok {
		return response, nil
	}
	return nil, ports.ErrNotFound
}

func (m *MockAIRepository) ListNLToSQLRequests(ctx context.Context, userID string, limit, offset int) ([]*domain.NLToSQLRequest, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var requests []*domain.NLToSQLRequest
	for _, request := range m.nlRequests {
		if request.UserID == userID {
			requests = append(requests, request)
		}
	}
	return requests, nil
}
