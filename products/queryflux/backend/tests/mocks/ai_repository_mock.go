package mocks

import (
	"context"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/queryflux/backend/internal/domain"
)

// MockAIRepository implements a mock AI repository for testing
type MockAIRepository struct {
	mock.Mock
}

func NewMockAIRepository() *MockAIRepository {
	return &MockAIRepository{}
}

func (m *MockAIRepository) CreateAIConfig(ctx context.Context, config *domain.AIConfig) error {
	args := m.Called(ctx, config)
	return args.Error(0)
}

func (m *MockAIRepository) GetAIConfig(ctx context.Context, service domain.AIService) (*domain.AIConfig, error) {
	args := m.Called(ctx, service)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.AIConfig), args.Error(1)
}

func (m *MockAIRepository) UpdateAIConfig(ctx context.Context, config *domain.AIConfig) error {
	args := m.Called(ctx, config)
	return args.Error(0)
}

func (m *MockAIRepository) DeleteAIConfig(ctx context.Context, service domain.AIService) error {
	args := m.Called(ctx, service)
	return args.Error(0)
}

func (m *MockAIRepository) ListAIConfigs(ctx context.Context) ([]*domain.AIConfig, error) {
	args := m.Called(ctx)
	return args.Get(0).([]*domain.AIConfig), args.Error(1)
}

func (m *MockAIRepository) CreateAIRequest(ctx context.Context, request *domain.AIRequest) error {
	args := m.Called(ctx, request)
	return args.Error(0)
}

func (m *MockAIRepository) GetAIRequest(ctx context.Context, id string) (*domain.AIRequest, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*domain.AIRequest), args.Error(1)
}

func (m *MockAIRepository) CreateAIResponse(ctx context.Context, response *domain.AIResponse) error {
	args := m.Called(ctx, response)
	return args.Error(0)
}

func (m *MockAIRepository) GetAIResponse(ctx context.Context, id string) (*domain.AIResponse, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*domain.AIResponse), args.Error(1)
}

func (m *MockAIRepository) ListAIRequests(ctx context.Context, userID string, limit, offset int) ([]*domain.AIRequest, error) {
	args := m.Called(ctx, userID, limit, offset)
	return args.Get(0).([]*domain.AIRequest), args.Error(1)
}

func (m *MockAIRepository) ListAIResponses(ctx context.Context, userID string, limit, offset int) ([]*domain.AIResponse, error) {
	args := m.Called(ctx, userID, limit, offset)
	return args.Get(0).([]*domain.AIResponse), args.Error(1)
}

func (m *MockAIRepository) CreateNLToSQLRequest(ctx context.Context, request *domain.NLToSQLRequest) error {
	args := m.Called(ctx, request)
	return args.Error(0)
}

func (m *MockAIRepository) GetNLToSQLRequest(ctx context.Context, id string) (*domain.NLToSQLRequest, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*domain.NLToSQLRequest), args.Error(1)
}

func (m *MockAIRepository) CreateNLToSQLResponse(ctx context.Context, response *domain.NLToSQLResponse) error {
	args := m.Called(ctx, response)
	return args.Error(0)
}

func (m *MockAIRepository) GetNLToSQLResponse(ctx context.Context, id string) (*domain.NLToSQLResponse, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*domain.NLToSQLResponse), args.Error(1)
}

func (m *MockAIRepository) ListNLToSQLRequests(ctx context.Context, userID string, limit, offset int) ([]*domain.NLToSQLRequest, error) {
	args := m.Called(ctx, userID, limit, offset)
	return args.Get(0).([]*domain.NLToSQLRequest), args.Error(1)
}

func (m *MockAIRepository) CreateQueryOptimizationRequest(ctx context.Context, request *domain.QueryOptimizationRequest) error {
	args := m.Called(ctx, request)
	return args.Error(0)
}

func (m *MockAIRepository) GetQueryOptimizationRequest(ctx context.Context, id string) (*domain.QueryOptimizationRequest, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*domain.QueryOptimizationRequest), args.Error(1)
}

func (m *MockAIRepository) CreateQueryOptimizationResponse(ctx context.Context, response *domain.QueryOptimizationResponse) error {
	args := m.Called(ctx, response)
	return args.Error(0)
}

func (m *MockAIRepository) GetQueryOptimizationResponse(ctx context.Context, id string) (*domain.QueryOptimizationResponse, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*domain.QueryOptimizationResponse), args.Error(1)
}

func (m *MockAIRepository) CreateQueryExplanationRequest(ctx context.Context, request *domain.QueryExplanationRequest) error {
	args := m.Called(ctx, request)
	return args.Error(0)
}

func (m *MockAIRepository) GetQueryExplanationRequest(ctx context.Context, id string) (*domain.QueryExplanationRequest, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*domain.QueryExplanationRequest), args.Error(1)
}

func (m *MockAIRepository) CreateQueryExplanationResponse(ctx context.Context, response *domain.QueryExplanationResponse) error {
	args := m.Called(ctx, response)
	return args.Error(0)
}

func (m *MockAIRepository) GetQueryExplanationResponse(ctx context.Context, id string) (*domain.QueryExplanationResponse, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*domain.QueryExplanationResponse), args.Error(1)
}

func (m *MockAIRepository) CreateAIUsage(ctx context.Context, usage *domain.AIUsage) error {
	args := m.Called(ctx, usage)
	return args.Error(0)
}

func (m *MockAIRepository) GetAIUsage(ctx context.Context, userID string, startDate, endDate time.Time) ([]*domain.AIUsage, error) {
	args := m.Called(ctx, userID, startDate, endDate)
	return args.Get(0).([]*domain.AIUsage), args.Error(1)
}

func (m *MockAIRepository) GetAIUsageByService(ctx context.Context, service domain.AIService, startDate, endDate time.Time) ([]*domain.AIUsage, error) {
	args := m.Called(ctx, service, startDate, endDate)
	return args.Get(0).([]*domain.AIUsage), args.Error(1)
}

func (m *MockAIRepository) CreateAIPromptTemplate(ctx context.Context, template *domain.AIPromptTemplate) error {
	args := m.Called(ctx, template)
	return args.Error(0)
}

func (m *MockAIRepository) GetAIPromptTemplate(ctx context.Context, id string) (*domain.AIPromptTemplate, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*domain.AIPromptTemplate), args.Error(1)
}

func (m *MockAIRepository) ListAIPromptTemplates(ctx context.Context, service domain.AIService, operation string) ([]*domain.AIPromptTemplate, error) {
	args := m.Called(ctx, service, operation)
	return args.Get(0).([]*domain.AIPromptTemplate), args.Error(1)
}

func (m *MockAIRepository) UpdateAIPromptTemplate(ctx context.Context, template *domain.AIPromptTemplate) error {
	args := m.Called(ctx, template)
	return args.Error(0)
}

func (m *MockAIRepository) DeleteAIPromptTemplate(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}