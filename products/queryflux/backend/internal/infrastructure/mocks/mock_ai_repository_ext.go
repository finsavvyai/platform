package mocks

import (
	"context"
	"time"

	"github.com/queryflux/backend/internal/application/ports"
	"github.com/queryflux/backend/internal/domain"
)

func (m *MockAIRepository) CreateQueryOptimizationRequest(ctx context.Context, request *domain.QueryOptimizationRequest) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.optRequests[request.ID] = request
	return nil
}

func (m *MockAIRepository) GetQueryOptimizationRequest(ctx context.Context, id string) (*domain.QueryOptimizationRequest, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if request, ok := m.optRequests[id]; ok {
		return request, nil
	}
	return nil, ports.ErrNotFound
}

func (m *MockAIRepository) CreateQueryOptimizationResponse(ctx context.Context, response *domain.QueryOptimizationResponse) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.optResponses[response.ID] = response
	return nil
}

func (m *MockAIRepository) GetQueryOptimizationResponse(ctx context.Context, id string) (*domain.QueryOptimizationResponse, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if response, ok := m.optResponses[id]; ok {
		return response, nil
	}
	return nil, ports.ErrNotFound
}

func (m *MockAIRepository) CreateQueryExplanationRequest(ctx context.Context, request *domain.QueryExplanationRequest) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.expRequests[request.ID] = request
	return nil
}

func (m *MockAIRepository) GetQueryExplanationRequest(ctx context.Context, id string) (*domain.QueryExplanationRequest, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if request, ok := m.expRequests[id]; ok {
		return request, nil
	}
	return nil, ports.ErrNotFound
}

func (m *MockAIRepository) CreateQueryExplanationResponse(ctx context.Context, response *domain.QueryExplanationResponse) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.expResponses[response.ID] = response
	return nil
}

func (m *MockAIRepository) GetQueryExplanationResponse(ctx context.Context, id string) (*domain.QueryExplanationResponse, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if response, ok := m.expResponses[id]; ok {
		return response, nil
	}
	return nil, ports.ErrNotFound
}

func (m *MockAIRepository) CreateAIUsage(ctx context.Context, usage *domain.AIUsage) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.usages[usage.UserID] == nil {
		m.usages[usage.UserID] = []*domain.AIUsage{}
	}
	m.usages[usage.UserID] = append(m.usages[usage.UserID], usage)
	return nil
}

func (m *MockAIRepository) GetAIUsage(ctx context.Context, userID string, startDate, endDate time.Time) ([]*domain.AIUsage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if usages, ok := m.usages[userID]; ok {
		var filtered []*domain.AIUsage
		for _, usage := range usages {
			if usage.CreatedAt.After(startDate) && usage.CreatedAt.Before(endDate) {
				filtered = append(filtered, usage)
			}
		}
		return filtered, nil
	}
	return nil, nil
}

func (m *MockAIRepository) GetAIUsageByService(ctx context.Context, service domain.AIService, startDate, endDate time.Time) ([]*domain.AIUsage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var allUsages []*domain.AIUsage
	for _, usages := range m.usages {
		allUsages = append(allUsages, usages...)
	}
	var filtered []*domain.AIUsage
	for _, usage := range allUsages {
		if usage.Service == service && usage.CreatedAt.After(startDate) && usage.CreatedAt.Before(endDate) {
			filtered = append(filtered, usage)
		}
	}
	return filtered, nil
}

func (m *MockAIRepository) CreateAIPromptTemplate(ctx context.Context, template *domain.AIPromptTemplate) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.templates[template.ID] = template
	return nil
}

func (m *MockAIRepository) GetAIPromptTemplate(ctx context.Context, id string) (*domain.AIPromptTemplate, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if template, ok := m.templates[id]; ok {
		return template, nil
	}
	return nil, ports.ErrNotFound
}

func (m *MockAIRepository) ListAIPromptTemplates(ctx context.Context, service domain.AIService, operation string) ([]*domain.AIPromptTemplate, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var templates []*domain.AIPromptTemplate
	for _, template := range m.templates {
		if template.Service == service && template.Operation == operation {
			templates = append(templates, template)
		}
	}
	return templates, nil
}

func (m *MockAIRepository) UpdateAIPromptTemplate(ctx context.Context, template *domain.AIPromptTemplate) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.templates[template.ID] = template
	return nil
}

func (m *MockAIRepository) DeleteAIPromptTemplate(ctx context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.templates, id)
	return nil
}
