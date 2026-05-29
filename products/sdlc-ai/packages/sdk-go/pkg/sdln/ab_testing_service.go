package sdln

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

// ========================================
// A/B Testing Service
// ========================================

// ABTestingService handles A/B testing operations
type ABTestingService struct {
	client *Client
}

// NewABTestingService creates a new A/B testing service
func NewABTestingService(client *Client) *ABTestingService {
	return &ABTestingService{client: client}
}

// ========================================
// Experiment Management
// ========================================

// CreateExperiment creates a new A/B test experiment
func (s *ABTestingService) CreateExperiment(ctx context.Context, req *CreateExperimentRequest) (*Experiment, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/ab/experiments", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var experiment Experiment
	if err := json.NewDecoder(resp.Body).Decode(&experiment); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &experiment, nil
}

// GetExperiment retrieves an experiment
func (s *ABTestingService) GetExperiment(ctx context.Context, experimentID string) (*Experiment, error) {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s", experimentID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var experiment Experiment
	if err := json.NewDecoder(resp.Body).Decode(&experiment); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &experiment, nil
}

// ListExperiments lists experiments
func (s *ABTestingService) ListExperiments(ctx context.Context, opts *ExperimentListOptions) (*PaginatedResponse[Experiment], error) {
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, "/api/v1/ab/experiments", nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var response PaginatedResponse[Experiment]
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// UpdateExperiment updates an experiment
func (s *ABTestingService) UpdateExperiment(ctx context.Context, experimentID string, req *UpdateExperimentRequest) (*Experiment, error) {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s", experimentID)
	resp, err := s.client.doRequest(ctx, http.MethodPut, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var experiment Experiment
	if err := json.NewDecoder(resp.Body).Decode(&experiment); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &experiment, nil
}

// DeleteExperiment deletes an experiment
func (s *ABTestingService) DeleteExperiment(ctx context.Context, experimentID string) error {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s", experimentID)
	_, err := s.client.doRequest(ctx, http.MethodDelete, path, nil)
	return err
}

// ========================================
// Experiment Control
// ========================================

// StartExperiment starts an experiment
func (s *ABTestingService) StartExperiment(ctx context.Context, experimentID string) error {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/start", experimentID)
	_, err := s.client.doRequest(ctx, http.MethodPost, path, nil)
	return err
}

// PauseExperiment pauses an experiment
func (s *ABTestingService) PauseExperiment(ctx context.Context, experimentID string) error {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/pause", experimentID)
	_, err := s.client.doRequest(ctx, http.MethodPost, path, nil)
	return err
}

// StopExperiment stops an experiment
func (s *ABTestingService) StopExperiment(ctx context.Context, experimentID string, req *StopExperimentRequest) (*ExperimentResult, error) {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/stop", experimentID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result ExperimentResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// ArchiveExperiment archives an experiment
func (s *ABTestingService) ArchiveExperiment(ctx context.Context, experimentID string) error {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/archive", experimentID)
	_, err := s.client.doRequest(ctx, http.MethodPost, path, nil)
	return err
}

// ========================================
// Variation Management
// ========================================

// AddVariation adds a variation to an experiment
func (s *ABTestingService) AddVariation(ctx context.Context, experimentID string, req *AddVariationRequest) (*Variation, error) {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/variations", experimentID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var variation Variation
	if err := json.NewDecoder(resp.Body).Decode(&variation); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &variation, nil
}

// GetVariations retrieves variations for an experiment
func (s *ABTestingService) GetVariations(ctx context.Context, experimentID string) ([]Variation, error) {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/variations", experimentID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var variations []Variation
	if err := json.NewDecoder(resp.Body).Decode(&variations); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return variations, nil
}

// UpdateVariation updates a variation
func (s *ABTestingService) UpdateVariation(ctx context.Context, experimentID, variationID string, req *UpdateVariationRequest) (*Variation, error) {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/variations/%s", experimentID, variationID)
	resp, err := s.client.doRequest(ctx, http.MethodPut, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var variation Variation
	if err := json.NewDecoder(resp.Body).Decode(&variation); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &variation, nil
}

// RemoveVariation removes a variation from an experiment
func (s *ABTestingService) RemoveVariation(ctx context.Context, experimentID, variationID string) error {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/variations/%s", experimentID, variationID)
	_, err := s.client.doRequest(ctx, http.MethodDelete, path, nil)
	return err
}

// ========================================
// Experiment Assignment
// ========================================

// AssignUser assigns a user to an experiment
func (s *ABTestingService) AssignUser(ctx context.Context, req *AssignUserRequest) (*ExperimentAssignment, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/ab/assign", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var assignment ExperimentAssignment
	if err := json.NewDecoder(resp.Body).Decode(&assignment); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &assignment, nil
}

// GetAssignment retrieves user's experiment assignment
func (s *ABTestingService) GetAssignment(ctx context.Context, userID, experimentID string) (*ExperimentAssignment, error) {
	path := fmt.Sprintf("/api/v1/ab/users/%s/experiments/%s/assignment", userID, experimentID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var assignment ExperimentAssignment
	if err := json.NewDecoder(resp.Body).Decode(&assignment); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &assignment, nil
}

// GetUserAssignments retrieves all user's experiment assignments
func (s *ABTestingService) GetUserAssignments(ctx context.Context, userID string) ([]ExperimentAssignment, error) {
	path := fmt.Sprintf("/api/v1/ab/users/%s/assignments", userID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var assignments []ExperimentAssignment
	if err := json.NewDecoder(resp.Body).Decode(&assignments); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return assignments, nil
}

// UnassignUser removes user from experiment
func (s *ABTestingService) UnassignUser(ctx context.Context, userID, experimentID string) error {
	path := fmt.Sprintf("/api/v1/ab/users/%s/experiments/%s/unassign", userID, experimentID)
	_, err := s.client.doRequest(ctx, http.MethodPost, path, nil)
	return err
}

// ========================================
// Event Tracking for Experiments
// ========================================

// TrackEvent tracks an event for experiment analysis
func (s *ABTestingService) TrackEvent(ctx context.Context, req *TrackExperimentEventRequest) error {
	_, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/ab/events/track", req)
	return err
}

// BatchTrackEvents tracks multiple events
func (s *ABTestingService) BatchTrackEvents(ctx context.Context, events []TrackExperimentEventRequest) error {
	req := &BatchTrackExperimentEventsRequest{Events: events}
	_, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/ab/events/batch", req)
	return err
}

// GetExperimentEvents retrieves events for an experiment
func (s *ABTestingService) GetExperimentEvents(ctx context.Context, experimentID string, opts *EventListOptions) (*PaginatedResponse[ExperimentEvent], error) {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/events", experimentID)
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, path, nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var response PaginatedResponse[ExperimentEvent]
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// ========================================
// Experiment Analysis and Results
// ========================================

// GetExperimentResults retrieves experiment results
func (s *ABTestingService) GetExperimentResults(ctx context.Context, experimentID string, opts *ResultsOptions) (*ExperimentResults, error) {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/results", experimentID)
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, path, nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var results ExperimentResults
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &results, nil
}

// GetStatisticalSignificance calculates statistical significance
func (s *ABTestingService) GetStatisticalSignificance(ctx context.Context, experimentID string) (*StatisticalSignificance, error) {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/significance", experimentID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var significance StatisticalSignificance
	if err := json.NewDecoder(resp.Body).Decode(&significance); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &significance, nil
}

// GetConversionRates retrieves conversion rates
func (s *ABTestingService) GetConversionRates(ctx context.Context, experimentID string) (*ConversionRates, error) {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/conversions", experimentID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var rates ConversionRates
	if err := json.NewDecoder(resp.Body).Decode(&rates); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &rates, nil
}

// GetVariationPerformance retrieves variation performance
func (s *ABTestingService) GetVariationPerformance(ctx context.Context, experimentID string) (*VariationPerformance, error) {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/performance", experimentID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var performance VariationPerformance
	if err := json.NewDecoder(resp.Body).Decode(&performance); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &performance, nil
}

// ========================================
// Experiment Goals
// ========================================

// CreateGoal creates an experiment goal
func (s *ABTestingService) CreateGoal(ctx context.Context, experimentID string, req *CreateGoalRequest) (*ExperimentGoal, error) {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/goals", experimentID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var goal ExperimentGoal
	if err := json.NewDecoder(resp.Body).Decode(&goal); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &goal, nil
}

// GetGoals retrieves goals for an experiment
func (s *ABTestingService) GetGoals(ctx context.Context, experimentID string) ([]ExperimentGoal, error) {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/goals", experimentID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var goals []ExperimentGoal
	if err := json.NewDecoder(resp.Body).Decode(&goals); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return goals, nil
}

// UpdateGoal updates an experiment goal
func (s *ABTestingService) UpdateGoal(ctx context.Context, experimentID, goalID string, req *UpdateGoalRequest) (*ExperimentGoal, error) {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/goals/%s", experimentID, goalID)
	resp, err := s.client.doRequest(ctx, http.MethodPut, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var goal ExperimentGoal
	if err := json.NewDecoder(resp.Body).Decode(&goal); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &goal, nil
}

// DeleteGoal deletes an experiment goal
func (s *ABTestingService) DeleteGoal(ctx context.Context, experimentID, goalID string) error {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/goals/%s", experimentID, goalID)
	_, err := s.client.doRequest(ctx, http.MethodDelete, path, nil)
	return err
}

// ========================================
// Experiment Segmentation
// ========================================

// CreateSegment creates an experiment segment
func (s *ABTestingService) CreateSegment(ctx context.Context, experimentID string, req *CreateExperimentSegmentRequest) (*ExperimentSegment, error) {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/segments", experimentID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var segment ExperimentSegment
	if err := json.NewDecoder(resp.Body).Decode(&segment); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &segment, nil
}

// GetSegments retrieves segments for an experiment
func (s *ABTestingService) GetSegments(ctx context.Context, experimentID string) ([]ExperimentSegment, error) {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/segments", experimentID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var segments []ExperimentSegment
	if err := json.NewDecoder(resp.Body).Decode(&segments); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return segments, nil
}

// GetSegmentResults retrieves results for a segment
func (s *ABTestingService) GetSegmentResults(ctx context.Context, experimentID, segmentID string) (*ExperimentResults, error) {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/segments/%s/results", experimentID, segmentID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var results ExperimentResults
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &results, nil
}

// ========================================
// Experiment Templates
// ========================================

// CreateTemplate creates an experiment template
func (s *ABTestingService) CreateTemplate(ctx context.Context, req *CreateExperimentTemplateRequest) (*ExperimentTemplate, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/ab/templates", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var template ExperimentTemplate
	if err := json.NewDecoder(resp.Body).Decode(&template); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &template, nil
}

// GetTemplate retrieves an experiment template
func (s *ABTestingService) GetTemplate(ctx context.Context, templateID string) (*ExperimentTemplate, error) {
	path := fmt.Sprintf("/api/v1/ab/templates/%s", templateID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var template ExperimentTemplate
	if err := json.NewDecoder(resp.Body).Decode(&template); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &template, nil
}

// ListTemplates lists experiment templates
func (s *ABTestingService) ListTemplates(ctx context.Context, opts *ListOptions) (*PaginatedResponse[ExperimentTemplate], error) {
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, "/api/v1/ab/templates", nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var response PaginatedResponse[ExperimentTemplate]
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// CreateFromTemplate creates experiment from template
func (s *ABTestingService) CreateFromTemplate(ctx context.Context, templateID string, req *CreateFromTemplateRequest) (*Experiment, error) {
	path := fmt.Sprintf("/api/v1/ab/templates/%s/create", templateID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var experiment Experiment
	if err := json.NewDecoder(resp.Body).Decode(&experiment); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &experiment, nil
}

// ========================================
// Experiment Reports
// ========================================

// GenerateReport generates an experiment report
func (s *ABTestingService) GenerateReport(ctx context.Context, experimentID string, req *GenerateExperimentReportRequest) (*ExperimentReport, error) {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/reports", experimentID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var report ExperimentReport
	if err := json.NewDecoder(resp.Body).Decode(&report); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &report, nil
}

// GetReport retrieves an experiment report
func (s *ABTestingService) GetReport(ctx context.Context, reportID string) (*ExperimentReport, error) {
	path := fmt.Sprintf("/api/v1/ab/reports/%s", reportID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var report ExperimentReport
	if err := json.NewDecoder(resp.Body).Decode(&report); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &report, nil
}

// ScheduleReport schedules an experiment report
func (s *ABTestingService) ScheduleReport(ctx context.Context, experimentID string, req *ScheduleExperimentReportRequest) (*ScheduledExperimentReport, error) {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/reports/schedule", experimentID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var scheduled ScheduledExperimentReport
	if err := json.NewDecoder(resp.Body).Decode(&scheduled); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &scheduled, nil
}

// ========================================
// Experiment Automation
// ========================================

// CreateAutoStopRule creates an automatic stop rule
func (s *ABTestingService) CreateAutoStopRule(ctx context.Context, experimentID string, req *CreateAutoStopRuleRequest) (*AutoStopRule, error) {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/autostop", experimentID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var rule AutoStopRule
	if err := json.NewDecoder(resp.Body).Decode(&rule); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &rule, nil
}

// GetAutoStopRules retrieves auto stop rules
func (s *ABTestingService) GetAutoStopRules(ctx context.Context, experimentID string) ([]AutoStopRule, error) {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/autostop", experimentID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var rules []AutoStopRule
	if err := json.NewDecoder(resp.Body).Decode(&rules); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return rules, nil
}

// EnableAutoStop enables automatic stop
func (s *ABTestingService) EnableAutoStop(ctx context.Context, experimentID string) error {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/autostop/enable", experimentID)
	_, err := s.client.doRequest(ctx, http.MethodPost, path, nil)
	return err
}

// DisableAutoStop disables automatic stop
func (s *ABTestingService) DisableAutoStop(ctx context.Context, experimentID string) error {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/autostop/disable", experimentID)
	_, err := s.client.doRequest(ctx, http.MethodPost, path, nil)
	return err
}

// ========================================
// Experiment Monitoring
// ========================================

// GetMonitoringStatus retrieves monitoring status
func (s *ABTestingService) GetMonitoringStatus(ctx context.Context, experimentID string) (*ExperimentMonitoringStatus, error) {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/monitoring", experimentID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var status ExperimentMonitoringStatus
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &status, nil
}

// SetAlerts sets experiment alerts
func (s *ABTestingService) SetAlerts(ctx context.Context, experimentID string, req *SetExperimentAlertsRequest) (*ExperimentAlerts, error) {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/alerts", experimentID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var alerts ExperimentAlerts
	if err := json.NewDecoder(resp.Body).Decode(&alerts); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &alerts, nil
}

// GetHealthCheck retrieves experiment health check
func (s *ABTestingService) GetHealthCheck(ctx context.Context, experimentID string) (*ExperimentHealthCheck, error) {
	path := fmt.Sprintf("/api/v1/ab/experiments/%s/health", experimentID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var health ExperimentHealthCheck
	if err := json.NewDecoder(resp.Body).Decode(&health); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &health, nil
}
