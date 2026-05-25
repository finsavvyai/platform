package sdln

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// ========================================
// User Analytics Service
// ========================================

// UserAnalyticsService handles user analytics and behavior tracking
type UserAnalyticsService struct {
	client *Client
}

// NewUserAnalyticsService creates a new user analytics service
func NewUserAnalyticsService(client *Client) *UserAnalyticsService {
	return &UserAnalyticsService{client: client}
}

// ========================================
// Event Tracking
// ========================================

// TrackEvent tracks a user event
func (s *UserAnalyticsService) TrackEvent(ctx context.Context, req *TrackEventRequest) (*EventTrackingResult, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/analytics/events/track", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result EventTrackingResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// BatchTrackEvents tracks multiple events
func (s *UserAnalyticsService) BatchTrackEvents(ctx context.Context, events []TrackEventRequest) (*BatchEventTrackingResult, error) {
	req := &BatchTrackEventsRequest{Events: events}
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/analytics/events/batch", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result BatchEventTrackingResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// GetEvents retrieves events
func (s *UserAnalyticsService) GetEvents(ctx context.Context, opts *EventListOptions) (*PaginatedResponse[UserEvent], error) {
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, "/api/v1/analytics/events", nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var response PaginatedResponse[UserEvent]
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// ========================================
// User Sessions
// ========================================

// StartSession starts a user session
func (s *UserAnalyticsService) StartSession(ctx context.Context, req *StartSessionRequest) (*UserSession, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/analytics/sessions/start", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var session UserSession
	if err := json.NewDecoder(resp.Body).Decode(&session); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &session, nil
}

// EndSession ends a user session
func (s *UserAnalyticsService) EndSession(ctx context.Context, sessionID string, req *EndSessionRequest) (*UserSession, error) {
	path := fmt.Sprintf("/api/v1/analytics/sessions/%s/end", sessionID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var session UserSession
	if err := json.NewDecoder(resp.Body).Decode(&session); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &session, nil
}

// GetSession retrieves a session
func (s *UserAnalyticsService) GetSession(ctx context.Context, sessionID string) (*UserSession, error) {
	path := fmt.Sprintf("/api/v1/analytics/sessions/%s", sessionID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var session UserSession
	if err := json.NewDecoder(resp.Body).Decode(&session); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &session, nil
}

// ListSessions lists user sessions
func (s *UserAnalyticsService) ListSessions(ctx context.Context, userID string, opts *SessionListOptions) (*PaginatedResponse[UserSession], error) {
	path := fmt.Sprintf("/api/v1/analytics/users/%s/sessions", userID)
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, path, nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var response PaginatedResponse[UserSession]
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// ========================================
// User Behavior Analysis
// ========================================

// AnalyzeBehavior analyzes user behavior patterns
func (s *UserAnalyticsService) AnalyzeBehavior(ctx context.Context, userID string, timeRange *TimestampRange) (*UserBehaviorAnalysis, error) {
	path := fmt.Sprintf("/api/v1/analytics/users/%s/behavior/analyze", userID)
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, path, nil, map[string]interface{}{
		"timeRange": timeRange,
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var analysis UserBehaviorAnalysis
	if err := json.NewDecoder(resp.Body).Decode(&analysis); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &analysis, nil
}

// GetUserJourney retrieves user journey
func (s *UserAnalyticsService) GetUserJourney(ctx context.Context, userID string, opts *JourneyOptions) (*UserJourney, error) {
	path := fmt.Sprintf("/api/v1/analytics/users/%s/journey", userID)
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, path, nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var journey UserJourney
	if err := json.NewDecoder(resp.Body).Decode(&journey); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &journey, nil
}

// GetFunnelAnalysis retrieves funnel analysis
func (s *UserAnalyticsService) GetFunnelAnalysis(ctx context.Context, req *FunnelAnalysisRequest) (*FunnelAnalysis, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/analytics/funnels/analyze", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var analysis FunnelAnalysis
	if err := json.NewDecoder(resp.Body).Decode(&analysis); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &analysis, nil
}

// GetCohortAnalysis retrieves cohort analysis
func (s *UserAnalyticsService) GetCohortAnalysis(ctx context.Context, req *CohortAnalysisRequest) (*CohortAnalysis, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/analytics/cohorts/analyze", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var analysis CohortAnalysis
	if err := json.NewDecoder(resp.Body).Decode(&analysis); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &analysis, nil
}

// ========================================
// User Segmentation
// ========================================

// CreateSegment creates a user segment
func (s *UserAnalyticsService) CreateSegment(ctx context.Context, req *CreateUserSegmentRequest) (*UserSegment, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/analytics/segments", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var segment UserSegment
	if err := json.NewDecoder(resp.Body).Decode(&segment); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &segment, nil
}

// GetSegment retrieves a user segment
func (s *UserAnalyticsService) GetSegment(ctx context.Context, segmentID string) (*UserSegment, error) {
	path := fmt.Sprintf("/api/v1/analytics/segments/%s", segmentID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var segment UserSegment
	if err := json.NewDecoder(resp.Body).Decode(&segment); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &segment, nil
}

// ListSegments lists user segments
func (s *UserAnalyticsService) ListSegments(ctx context.Context, opts *ListOptions) (*PaginatedResponse[UserSegment], error) {
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, "/api/v1/analytics/segments", nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var response PaginatedResponse[UserSegment]
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// UpdateSegment updates a user segment
func (s *UserAnalyticsService) UpdateSegment(ctx context.Context, segmentID string, req *UpdateUserSegmentRequest) (*UserSegment, error) {
	path := fmt.Sprintf("/api/v1/analytics/segments/%s", segmentID)
	resp, err := s.client.doRequest(ctx, http.MethodPut, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var segment UserSegment
	if err := json.NewDecoder(resp.Body).Decode(&segment); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &segment, nil
}

// DeleteSegment deletes a user segment
func (s *UserAnalyticsService) DeleteSegment(ctx context.Context, segmentID string) error {
	path := fmt.Sprintf("/api/v1/analytics/segments/%s", segmentID)
	_, err := s.client.doRequest(ctx, http.MethodDelete, path, nil)
	return err
}

// GetSegmentUsers retrieves users in a segment
func (s *UserAnalyticsService) GetSegmentUsers(ctx context.Context, segmentID string, opts *ListOptions) (*PaginatedResponse[User], error) {
	path := fmt.Sprintf("/api/v1/analytics/segments/%s/users", segmentID)
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, path, nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var response PaginatedResponse[User]
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// ========================================
// User Metrics
// ========================================

// GetUserMetrics retrieves user metrics
func (s *UserAnalyticsService) GetUserMetrics(ctx context.Context, userID string, timeRange *TimestampRange) (*UserMetrics, error) {
	path := fmt.Sprintf("/api/v1/analytics/users/%s/metrics", userID)
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, path, nil, map[string]interface{}{
		"timeRange": timeRange,
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var metrics UserMetrics
	if err := json.NewDecoder(resp.Body).Decode(&metrics); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &metrics, nil
}

// GetAggregatedMetrics retrieves aggregated metrics
func (s *UserAnalyticsService) GetAggregatedMetrics(ctx context.Context, req *AggregatedMetricsRequest) (*AggregatedUserMetrics, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/analytics/metrics/aggregated", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var metrics AggregatedUserMetrics
	if err := json.NewDecoder(resp.Body).Decode(&metrics); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &metrics, nil
}

// GetRetentionMetrics retrieves retention metrics
func (s *UserAnalyticsService) GetRetentionMetrics(ctx context.Context, req *RetentionMetricsRequest) (*RetentionMetrics, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/analytics/metrics/retention", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var metrics RetentionMetrics
	if err := json.NewDecoder(resp.Body).Decode(&metrics); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &metrics, nil
}

// GetEngagementMetrics retrieves engagement metrics
func (s *UserAnalyticsService) GetEngagementMetrics(ctx context.Context, req *EngagementMetricsRequest) (*EngagementMetrics, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/analytics/metrics/engagement", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var metrics EngagementMetrics
	if err := json.NewDecoder(resp.Body).Decode(&metrics); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &metrics, nil
}

// ========================================
// Heatmaps and Click Tracking
// ========================================

// TrackClick tracks user click
func (s *UserAnalyticsService) TrackClick(ctx context.Context, req *TrackClickRequest) (*ClickTrackingResult, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/analytics/clicks/track", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result ClickTrackingResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// GetHeatmapData retrieves heatmap data
func (s *UserAnalyticsService) GetHeatmapData(ctx context.Context, req *HeatmapRequest) (*HeatmapData, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/analytics/heatmap", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data HeatmapData
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &data, nil
}

// GetScrollDepth retrieves scroll depth data
func (s *UserAnalyticsService) GetScrollDepth(ctx context.Context, req *ScrollDepthRequest) (*ScrollDepthData, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/analytics/scroll-depth", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data ScrollDepthData
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &data, nil
}

// ========================================
// Real-time Analytics
// ========================================

// GetRealTimeMetrics retrieves real-time metrics
func (s *UserAnalyticsService) GetRealTimeMetrics(ctx context.Context, opts *RealTimeOptions) (*RealTimeMetrics, error) {
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, "/api/v1/analytics/realtime", nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var metrics RealTimeMetrics
	if err := json.NewDecoder(resp.Body).Decode(&metrics); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &metrics, nil
}

// GetActiveUsers retrieves active users
func (s *UserAnalyticsService) GetActiveUsers(ctx context.Context, duration time.Duration) (*ActiveUsers, error) {
	path := "/api/v1/analytics/realtime/active-users"
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, path, nil, map[string]interface{}{
		"duration": duration.String(),
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var active ActiveUsers
	if err := json.NewDecoder(resp.Body).Decode(&active); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &active, nil
}

// ========================================
// Predictive Analytics
// ========================================

// PredictChurn predicts user churn
func (s *UserAnalyticsService) PredictChurn(ctx context.Context, userID string) (*ChurnPrediction, error) {
	path := fmt.Sprintf("/api/v1/analytics/users/%s/predict/churn", userID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var prediction ChurnPrediction
	if err := json.NewDecoder(resp.Body).Decode(&prediction); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &prediction, nil
}

// GetRecommendations retrieves user recommendations
func (s *UserAnalyticsService) GetRecommendations(ctx context.Context, userID string) ([]UserRecommendation, error) {
	path := fmt.Sprintf("/api/v1/analytics/users/%s/recommendations", userID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var recommendations []UserRecommendation
	if err := json.NewDecoder(resp.Body).Decode(&recommendations); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return recommendations, nil
}

// ========================================
// Analytics Reports
// ========================================

// GenerateReport generates an analytics report
func (s *UserAnalyticsService) GenerateReport(ctx context.Context, req *GenerateAnalyticsReportRequest) (*AnalyticsReport, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/analytics/reports", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var report AnalyticsReport
	if err := json.NewDecoder(resp.Body).Decode(&report); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &report, nil
}

// GetReport retrieves an analytics report
func (s *UserAnalyticsService) GetReport(ctx context.Context, reportID string) (*AnalyticsReport, error) {
	path := fmt.Sprintf("/api/v1/analytics/reports/%s", reportID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var report AnalyticsReport
	if err := json.NewDecoder(resp.Body).Decode(&report); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &report, nil
}

// ScheduleReport schedules an analytics report
func (s *UserAnalyticsService) ScheduleReport(ctx context.Context, req *ScheduleAnalyticsReportRequest) (*ScheduledAnalyticsReport, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/analytics/reports/schedule", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var scheduled ScheduledAnalyticsReport
	if err := json.NewDecoder(resp.Body).Decode(&scheduled); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &scheduled, nil
}

// ExportAnalytics exports analytics data
func (s *UserAnalyticsService) ExportAnalytics(ctx context.Context, req *ExportAnalyticsRequest) (*AnalyticsExport, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/analytics/export", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var export AnalyticsExport
	if err := json.NewDecoder(resp.Body).Decode(&export); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &export, nil
}

// BatchTrackEventsRequest represents a request to batch track events
type BatchTrackEventsRequest struct {
	Events []TrackEventRequest `json:"events"`
}
