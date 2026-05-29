package sdln

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

// ========================================
// Feedback Service
// ========================================

// FeedbackService handles user feedback collection and analysis
type FeedbackService struct {
	client *Client
}

// NewFeedbackService creates a new feedback service
func NewFeedbackService(client *Client) *FeedbackService {
	return &FeedbackService{client: client}
}

// ========================================
// Feedback Collection
// ========================================

// SubmitFeedback submits user feedback
func (s *FeedbackService) SubmitFeedback(ctx context.Context, req *SubmitFeedbackRequest) (*Feedback, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/feedback", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var feedback Feedback
	if err := json.NewDecoder(resp.Body).Decode(&feedback); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &feedback, nil
}

// GetFeedback retrieves a feedback item
func (s *FeedbackService) GetFeedback(ctx context.Context, feedbackID string) (*Feedback, error) {
	path := fmt.Sprintf("/api/v1/feedback/%s", feedbackID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var feedback Feedback
	if err := json.NewDecoder(resp.Body).Decode(&feedback); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &feedback, nil
}

// ListFeedback lists feedback items
func (s *FeedbackService) ListFeedback(ctx context.Context, opts *FeedbackListOptions) (*PaginatedResponse[Feedback], error) {
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, "/api/v1/feedback", nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var response PaginatedResponse[Feedback]
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// UpdateFeedback updates feedback
func (s *FeedbackService) UpdateFeedback(ctx context.Context, feedbackID string, req *UpdateFeedbackRequest) (*Feedback, error) {
	path := fmt.Sprintf("/api/v1/feedback/%s", feedbackID)
	resp, err := s.client.doRequest(ctx, http.MethodPut, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var feedback Feedback
	if err := json.NewDecoder(resp.Body).Decode(&feedback); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &feedback, nil
}

// DeleteFeedback deletes feedback
func (s *FeedbackService) DeleteFeedback(ctx context.Context, feedbackID string) error {
	path := fmt.Sprintf("/api/v1/feedback/%s", feedbackID)
	_, err := s.client.doRequest(ctx, http.MethodDelete, path, nil)
	return err
}

// ========================================
// Feedback Analysis
// ========================================

// AnalyzeFeedback analyzes feedback using AI
func (s *FeedbackService) AnalyzeFeedback(ctx context.Context, feedbackID string) (*FeedbackAnalysis, error) {
	path := fmt.Sprintf("/api/v1/feedback/%s/analyze", feedbackID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var analysis FeedbackAnalysis
	if err := json.NewDecoder(resp.Body).Decode(&analysis); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &analysis, nil
}

// BatchAnalyzeFeedback analyzes multiple feedback items
func (s *FeedbackService) BatchAnalyzeFeedback(ctx context.Context, feedbackIDs []string) ([]*FeedbackAnalysis, error) {
	req := &BatchAnalyzeRequest{FeedbackIDs: feedbackIDs}
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/feedback/batch-analyze", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var analyses []*FeedbackAnalysis
	if err := json.NewDecoder(resp.Body).Decode(&analyses); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return analyses, nil
}

// GetSentimentAnalysis retrieves sentiment analysis for feedback
func (s *FeedbackService) GetSentimentAnalysis(ctx context.Context, opts *FeedbackAnalysisOptions) (*SentimentAnalysisReport, error) {
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, "/api/v1/feedback/sentiment", nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var report SentimentAnalysisReport
	if err := json.NewDecoder(resp.Body).Decode(&report); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &report, nil
}

// GetFeedbackTrends retrieves feedback trends
func (s *FeedbackService) GetFeedbackTrends(ctx context.Context, opts *FeedbackTrendOptions) (*FeedbackTrendReport, error) {
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, "/api/v1/feedback/trends", nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var report FeedbackTrendReport
	if err := json.NewDecoder(resp.Body).Decode(&report); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &report, nil
}

// ========================================
// Feedback Categories and Tags
// ========================================

// CreateCategory creates a feedback category
func (s *FeedbackService) CreateCategory(ctx context.Context, req *CreateFeedbackCategoryRequest) (*FeedbackCategory, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/feedback/categories", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var category FeedbackCategory
	if err := json.NewDecoder(resp.Body).Decode(&category); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &category, nil
}

// ListCategories lists feedback categories
func (s *FeedbackService) ListCategories(ctx context.Context, opts *ListOptions) (*PaginatedResponse[FeedbackCategory], error) {
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, "/api/v1/feedback/categories", nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var response PaginatedResponse[FeedbackCategory]
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// CategorizeFeedback categorizes feedback automatically
func (s *FeedbackService) CategorizeFeedback(ctx context.Context, feedbackID string, categoryIDs []string) error {
	path := fmt.Sprintf("/api/v1/feedback/%s/categorize", feedbackID)
	req := &CategorizeRequest{CategoryIDs: categoryIDs}
	_, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	return err
}

// ========================================
// Feedback Responses
// ========================================

// CreateResponse creates a response to feedback
func (s *FeedbackService) CreateResponse(ctx context.Context, feedbackID string, req *CreateFeedbackResponseRequest) (*FeedbackResponse, error) {
	path := fmt.Sprintf("/api/v1/feedback/%s/responses", feedbackID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var response FeedbackResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// GetResponses retrieves responses for feedback
func (s *FeedbackService) GetResponses(ctx context.Context, feedbackID string, opts *ListOptions) (*PaginatedResponse[FeedbackResponse], error) {
	path := fmt.Sprintf("/api/v1/feedback/%s/responses", feedbackID)
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, path, nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var response PaginatedResponse[FeedbackResponse]
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// UpdateResponse updates a feedback response
func (s *FeedbackService) UpdateResponse(ctx context.Context, feedbackID, responseID string, req *UpdateFeedbackResponseRequest) (*FeedbackResponse, error) {
	path := fmt.Sprintf("/api/v1/feedback/%s/responses/%s", feedbackID, responseID)
	resp, err := s.client.doRequest(ctx, http.MethodPut, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var response FeedbackResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// SendResponseNotification sends notification of response
func (s *FeedbackService) SendResponseNotification(ctx context.Context, feedbackID, responseID string) error {
	path := fmt.Sprintf("/api/v1/feedback/%s/responses/%s/notify", feedbackID, responseID)
	_, err := s.client.doRequest(ctx, http.MethodPost, path, nil)
	return err
}

// ========================================
// Feedback Metrics and Reports
// ========================================

// GetFeedbackMetrics retrieves feedback metrics
func (s *FeedbackService) GetFeedbackMetrics(ctx context.Context, opts *FeedbackMetricsOptions) (*FeedbackMetrics, error) {
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, "/api/v1/feedback/metrics", nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var metrics FeedbackMetrics
	if err := json.NewDecoder(resp.Body).Decode(&metrics); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &metrics, nil
}

// GenerateFeedbackReport generates a feedback report
func (s *FeedbackService) GenerateFeedbackReport(ctx context.Context, req *GenerateFeedbackReportRequest) (*FeedbackReport, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/feedback/reports", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var report FeedbackReport
	if err := json.NewDecoder(resp.Body).Decode(&report); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &report, nil
}

// GetReport retrieves a feedback report
func (s *FeedbackService) GetReport(ctx context.Context, reportID string) (*FeedbackReport, error) {
	path := fmt.Sprintf("/api/v1/feedback/reports/%s", reportID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var report FeedbackReport
	if err := json.NewDecoder(resp.Body).Decode(&report); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &report, nil
}

// ExportFeedback exports feedback data
func (s *FeedbackService) ExportFeedback(ctx context.Context, req *ExportFeedbackRequest) (*FeedbackExport, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/feedback/export", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var export FeedbackExport
	if err := json.NewDecoder(resp.Body).Decode(&export); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &export, nil
}

// DownloadExport downloads exported feedback data
func (s *FeedbackService) DownloadExport(ctx context.Context, exportID string) ([]byte, error) {
	path := fmt.Sprintf("/api/v1/feedback/exports/%s/download", exportID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data []byte
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return data, nil
}

// ========================================
// Feedback Actions and Workflows
// ========================================

// CreateAction creates an action from feedback
func (s *FeedbackService) CreateAction(ctx context.Context, feedbackID string, req *CreateFeedbackActionRequest) (*FeedbackAction, error) {
	path := fmt.Sprintf("/api/v1/feedback/%s/actions", feedbackID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var action FeedbackAction
	if err := json.NewDecoder(resp.Body).Decode(&action); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &action, nil
}

// GetActions retrieves actions for feedback
func (s *FeedbackService) GetActions(ctx context.Context, feedbackID string, opts *ListOptions) (*PaginatedResponse[FeedbackAction], error) {
	path := fmt.Sprintf("/api/v1/feedback/%s/actions", feedbackID)
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, path, nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var response PaginatedResponse[FeedbackAction]
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// UpdateAction updates a feedback action
func (s *FeedbackService) UpdateAction(ctx context.Context, feedbackID, actionID string, req *UpdateFeedbackActionRequest) (*FeedbackAction, error) {
	path := fmt.Sprintf("/api/v1/feedback/%s/actions/%s", feedbackID, actionID)
	resp, err := s.client.doRequest(ctx, http.MethodPut, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var action FeedbackAction
	if err := json.NewDecoder(resp.Body).Decode(&action); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &action, nil
}

// CompleteAction marks an action as complete
func (s *FeedbackService) CompleteAction(ctx context.Context, feedbackID, actionID string, req *CompleteActionRequest) (*FeedbackAction, error) {
	path := fmt.Sprintf("/api/v1/feedback/%s/actions/%s/complete", feedbackID, actionID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var action FeedbackAction
	if err := json.NewDecoder(resp.Body).Decode(&action); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &action, nil
}
