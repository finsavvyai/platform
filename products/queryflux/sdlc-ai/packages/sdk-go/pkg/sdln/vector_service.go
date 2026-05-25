package sdln

import (
	"context"
	"fmt"
	"math"
	"time"
)

// VectorService handles vector database operations
type VectorService struct {
	*BaseService
}

// NewVectorService creates a new vector service
func NewVectorService(client *Client) *VectorService {
	return &VectorService{
		BaseService: NewBaseService(client, "vectors", "api/v1/vectors"),
	}
}

// VectorCreateRequest represents a request to create vectors
type VectorCreateRequest struct {
	TenantID    string                 `json:"tenant_id"`
	Vectors     []VectorInput          `json:"vectors"`
	Namespace   string                 `json:"namespace,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	BatchSize   int                    `json:"batch_size,omitempty"`
	WaitForSync bool                   `json:"wait_for_sync,omitempty"`
}

// VectorInput represents a single vector input
type VectorInput struct {
	ID       string                 `json:"id"`
	Values   []float64              `json:"values"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
	Score    *float64               `json:"score,omitempty"`
}

// Vector represents a stored vector
type Vector struct {
	ID        string                 `json:"id"`
	TenantID  string                 `json:"tenant_id"`
	Namespace string                 `json:"namespace"`
	Values    []float64              `json:"values"`
	Dimension int                    `json:"dimension"`
	Metadata  map[string]interface{} `json:"metadata"`
	Score     *float64               `json:"score,omitempty"`
	CreatedAt Timestamp                   `json:"created_at"`
	UpdatedAt Timestamp                   `json:"updated_at"`
}

// SearchRequest represents a vector search request
type SearchRequest struct {
	TenantID        string                 `json:"tenant_id"`
	Vector          []float64              `json:"vector"`
	TopK            int                    `json:"top_k,omitempty"`
	Namespace       string                 `json:"namespace,omitempty"`
	IncludeVector   bool                   `json:"include_vector,omitempty"`
	IncludeMetadata bool                   `json:"include_metadata,omitempty"`
	Filters         map[string]interface{} `json:"filters,omitempty"`
	SearchParams    *SearchParams          `json:"search_params,omitempty"`
}

// SearchParams controls search behavior
type SearchParams struct {
	EF        int     `json:"ef,omitempty"`         // HNSW search parameter
	Epsilon   float64 `json:"epsilon,omitempty"`    // Search precision threshold
	MaxVector int     `json:"max_vector,omitempty"` // Maximum vectors to examine
}

// SearchResult represents a single search result
type SearchResult struct {
	ID       string                 `json:"id"`
	Score    float64                `json:"score"`
	Vector   []float64              `json:"vector,omitempty"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// VectorSearchResponse represents a vector search response
type VectorSearchResponse struct {
	Namespace string                 `json:"namespace"`
	Results   []SearchResult         `json:"results"`
	Time      time.Duration          `json:"time"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// Index represents a vector index
type Index struct {
	ID          string                 `json:"id"`
	TenantID    string                 `json:"tenant_id"`
	Name        string                 `json:"name"`
	Namespace   string                 `json:"namespace"`
	Dimension   int                    `json:"dimension"`
	Metric      string                 `json:"metric"` // euclidean, cosine, dotproduct
	Engine      string                 `json:"engine"` // hnsw, ivf, flat
	Parameters  map[string]interface{} `json:"parameters"`
	VectorCount int64                  `json:"vector_count"`
	Status      string                 `json:"status"` // ready, indexing, error
	Size        int64                  `json:"size"`   // in bytes
	CreatedAt   Timestamp                   `json:"created_at"`
	UpdatedAt   Timestamp                   `json:"updated_at"`
}

// CreateIndexRequest represents a request to create an index
type CreateIndexRequest struct {
	TenantID   string                 `json:"tenant_id"`
	Name       string                 `json:"name"`
	Namespace  string                 `json:"namespace,omitempty"`
	Dimension  int                    `json:"dimension"`
	Metric     string                 `json:"metric"`
	Engine     string                 `json:"engine"`
	Parameters map[string]interface{} `json:"parameters,omitempty"`
}

// Namespace represents a vector namespace
type Namespace struct {
	ID          string `json:"id"`
	TenantID    string `json:"tenant_id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	VectorCount int64  `json:"vector_count"`
	Size        int64  `json:"size"` // in bytes
	CreatedAt   Timestamp   `json:"created_at"`
	UpdatedAt   Timestamp   `json:"updated_at"`
}

// Create creates vectors
func (s *VectorService) Create(ctx context.Context, req *VectorCreateRequest) (*VectorCreateResult, error) {
	var result VectorCreateResult
	err := s.doPost(ctx, "/vectors", req, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to create vectors: %w", err)
	}
	return &result, nil
}

// Upsert updates or inserts vectors
func (s *VectorService) Upsert(ctx context.Context, req *VectorCreateRequest) (*VectorCreateResult, error) {
	var result VectorCreateResult
	err := s.doPut(ctx, "/vectors", req, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to upsert vectors: %w", err)
	}
	return &result, nil
}

// Get retrieves a vector by ID
func (s *VectorService) Get(ctx context.Context, tenantID, namespace, vectorID string, includeVector bool) (*Vector, error) {
	path := fmt.Sprintf("/tenants/%s/namespaces/%s/vectors/%s", tenantID, namespace, vectorID)
	if includeVector {
		path += "?include_vector=true"
	}

	var vector Vector
	err := s.doGet(ctx, path, &vector)
	if err != nil {
		return nil, fmt.Errorf("failed to get vector: %w", err)
	}
	return &vector, nil
}

// Delete deletes vectors
func (s *VectorService) Delete(ctx context.Context, tenantID, namespace string, vectorIDs []string) (*VectorDeleteResult, error) {
	req := map[string]interface{}{
		"vector_ids": vectorIDs,
	}

	var result VectorDeleteResult
	err := s.doPost(ctx, fmt.Sprintf("/tenants/%s/namespaces/%s/delete", tenantID, namespace), req, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to delete vectors: %w", err)
	}
	return &result, nil
}

// Search performs vector similarity search
func (s *VectorService) Search(ctx context.Context, req *SearchRequest) (*VectorSearchResponse, error) {
	var response VectorSearchResponse
	err := s.doPost(ctx, "/search", req, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to search vectors: %w", err)
	}
	return &response, nil
}

// BatchSearch performs multiple vector searches
func (s *VectorService) BatchSearch(ctx context.Context, requests []SearchRequest) ([]*VectorSearchResponse, error) {
	req := map[string]interface{}{
		"searches": requests,
	}

	var responses []*VectorSearchResponse
	err := s.doPost(ctx, "/search/batch", req, &responses)
	if err != nil {
		return nil, fmt.Errorf("failed to batch search vectors: %w", err)
	}
	return responses, nil
}

// CreateIndex creates a new vector index
func (s *VectorService) CreateIndex(ctx context.Context, req *CreateIndexRequest) (*Index, error) {
	var index Index
	err := s.doPost(ctx, "/indexes", req, &index)
	if err != nil {
		return nil, fmt.Errorf("failed to create index: %w", err)
	}
	return &index, nil
}

// GetIndex retrieves an index by ID
func (s *VectorService) GetIndex(ctx context.Context, tenantID, indexID string) (*Index, error) {
	var index Index
	err := s.doGet(ctx, fmt.Sprintf("/tenants/%s/indexes/%s", tenantID, indexID), &index)
	if err != nil {
		return nil, fmt.Errorf("failed to get index: %w", err)
	}
	return &index, nil
}

// ListIndexes retrieves all indexes for a tenant
func (s *VectorService) ListIndexes(ctx context.Context, tenantID string, opts *ListOptions) (*PaginatedResponse[Index], error) {
	path := fmt.Sprintf("/tenants/%s/indexes", tenantID)
	if opts != nil {
		path += s.buildQuery(map[string]interface{}{
			"page":      opts.Page,
			"page_size": opts.PageSize,
			"sort_by":   opts.SortBy,
			"sort_desc": opts.SortDesc,
		})
	}

	var response PaginatedResponse[Index]
	err := s.doGet(ctx, path, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list indexes: %w", err)
	}
	return &response, nil
}

// DeleteIndex deletes an index
func (s *VectorService) DeleteIndex(ctx context.Context, tenantID, indexID string) error {
	err := s.doDelete(ctx, fmt.Sprintf("/tenants/%s/indexes/%s", tenantID, indexID))
	if err != nil {
		return fmt.Errorf("failed to delete index: %w", err)
	}
	return nil
}

// CreateNamespace creates a new namespace
func (s *VectorService) CreateNamespace(ctx context.Context, tenantID, name, description string) (*Namespace, error) {
	req := map[string]interface{}{
		"name":        name,
		"description": description,
	}

	var namespace Namespace
	err := s.doPost(ctx, fmt.Sprintf("/tenants/%s/namespaces", tenantID), req, &namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to create namespace: %w", err)
	}
	return &namespace, nil
}

// GetNamespace retrieves a namespace
func (s *VectorService) GetNamespace(ctx context.Context, tenantID, namespace string) (*Namespace, error) {
	var ns Namespace
	err := s.doGet(ctx, fmt.Sprintf("/tenants/%s/namespaces/%s", tenantID, namespace), &ns)
	if err != nil {
		return nil, fmt.Errorf("failed to get namespace: %w", err)
	}
	return &ns, nil
}

// ListNamespaces retrieves all namespaces for a tenant
func (s *VectorService) ListNamespaces(ctx context.Context, tenantID string, opts *ListOptions) (*PaginatedResponse[Namespace], error) {
	path := fmt.Sprintf("/tenants/%s/namespaces", tenantID)
	if opts != nil {
		path += s.buildQuery(map[string]interface{}{
			"page":      opts.Page,
			"page_size": opts.PageSize,
			"sort_by":   opts.SortBy,
			"sort_desc": opts.SortDesc,
		})
	}

	var response PaginatedResponse[Namespace]
	err := s.doGet(ctx, path, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list namespaces: %w", err)
	}
	return &response, nil
}

// DeleteNamespace deletes a namespace
func (s *VectorService) DeleteNamespace(ctx context.Context, tenantID, namespace string) error {
	err := s.doDelete(ctx, fmt.Sprintf("/tenants/%s/namespaces/%s", tenantID, namespace))
	if err != nil {
		return fmt.Errorf("failed to delete namespace: %w", err)
	}
	return nil
}

// GetStats retrieves vector statistics
func (s *VectorService) GetStats(ctx context.Context, tenantID, namespace string) (*VectorStats, error) {
	var stats VectorStats
	path := fmt.Sprintf("/tenants/%s/stats", tenantID)
	if namespace != "" {
		path += fmt.Sprintf("?namespace=%s", namespace)
	}

	err := s.doGet(ctx, path, &stats)
	if err != nil {
		return nil, fmt.Errorf("failed to get vector stats: %w", err)
	}
	return &stats, nil
}

// VectorCreateResult represents the result of vector creation
type VectorCreateResult struct {
	CreatedIDs []string       `json:"created_ids"`
	FailedIDs  []FailedVector `json:"failed_ids"`
	Time       time.Duration  `json:"time"`
}

// VectorDeleteResult represents the result of vector deletion
type VectorDeleteResult struct {
	DeletedIDs []string       `json:"deleted_ids"`
	FailedIDs  []FailedVector `json:"failed_ids"`
	Time       time.Duration  `json:"time"`
}

// FailedVector represents a failed vector operation
type FailedVector struct {
	ID    string `json:"id"`
	Error string `json:"error"`
	Code  string `json:"code"`
}

// VectorStats represents vector statistics
type VectorStats struct {
	TenantID       string                 `json:"tenant_id"`
	Namespace      string                 `json:"namespace,omitempty"`
	TotalVectors   int64                  `json:"total_vectors"`
	TotalSize      int64                  `json:"total_size"` // in bytes
	IndexCount     int                    `json:"index_count"`
	NamespaceCount int                    `json:"namespace_count"`
	AvgDimension   float64                `json:"avg_dimension"`
	Metrics        map[string]interface{} `json:"metrics"`
	LastUpdated    Timestamp                   `json:"last_updated"`
}

// CosineSimilarity calculates cosine similarity between two vectors
func CosineSimilarity(a, b []float64) (float64, error) {
	if len(a) != len(b) {
		return 0, fmt.Errorf("vectors must have the same dimension")
	}

	var dotProduct, normA, normB float64
	for i := 0; i < len(a); i++ {
		dotProduct += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}

	if normA == 0 || normB == 0 {
		return 0, fmt.Errorf("cannot compute similarity with zero vector")
	}

	return dotProduct / (math.Sqrt(normA) * math.Sqrt(normB)), nil
}

// EuclideanDistance calculates Euclidean distance between two vectors
func EuclideanDistance(a, b []float64) (float64, error) {
	if len(a) != len(b) {
		return 0, fmt.Errorf("vectors must have the same dimension")
	}

	var sum float64
	for i := 0; i < len(a); i++ {
		diff := a[i] - b[i]
		sum += diff * diff
	}

	return math.Sqrt(sum), nil
}

// DotProduct calculates dot product of two vectors
func DotProduct(a, b []float64) (float64, error) {
	if len(a) != len(b) {
		return 0, fmt.Errorf("vectors must have the same dimension")
	}

	var product float64
	for i := 0; i < len(a); i++ {
		product += a[i] * b[i]
	}

	return product, nil
}
