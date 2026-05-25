package sdln

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

// ========================================
// Bug Tracking Service
// ========================================

// BugTrackingService handles bug tracking and issue management
type BugTrackingService struct {
	client *Client
}

// NewBugTrackingService creates a new bug tracking service
func NewBugTrackingService(client *Client) *BugTrackingService {
	return &BugTrackingService{client: client}
}

// ========================================
// Bug Management
// ========================================

// CreateBug creates a new bug report
func (s *BugTrackingService) CreateBug(ctx context.Context, req *CreateBugRequest) (*Bug, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/bugs", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var bug Bug
	if err := json.NewDecoder(resp.Body).Decode(&bug); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &bug, nil
}

// GetBug retrieves a bug
func (s *BugTrackingService) GetBug(ctx context.Context, bugID string) (*Bug, error) {
	path := fmt.Sprintf("/api/v1/bugs/%s", bugID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var bug Bug
	if err := json.NewDecoder(resp.Body).Decode(&bug); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &bug, nil
}

// ListBugs lists bugs
func (s *BugTrackingService) ListBugs(ctx context.Context, opts *BugListOptions) (*PaginatedResponse[Bug], error) {
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, "/api/v1/bugs", nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var response PaginatedResponse[Bug]
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// UpdateBug updates a bug
func (s *BugTrackingService) UpdateBug(ctx context.Context, bugID string, req *UpdateBugRequest) (*Bug, error) {
	path := fmt.Sprintf("/api/v1/bugs/%s", bugID)
	resp, err := s.client.doRequest(ctx, http.MethodPut, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var bug Bug
	if err := json.NewDecoder(resp.Body).Decode(&bug); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &bug, nil
}

// DeleteBug deletes a bug
func (s *BugTrackingService) DeleteBug(ctx context.Context, bugID string) error {
	path := fmt.Sprintf("/api/v1/bugs/%s", bugID)
	_, err := s.client.doRequest(ctx, http.MethodDelete, path, nil)
	return err
}

// ========================================
// Bug Categorization and Prioritization
// ========================================

// CategorizeBug categorizes a bug using AI
func (s *BugTrackingService) CategorizeBug(ctx context.Context, bugID string) (*BugCategorization, error) {
	path := fmt.Sprintf("/api/v1/bugs/%s/categorize", bugID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var categorization BugCategorization
	if err := json.NewDecoder(resp.Body).Decode(&categorization); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &categorization, nil
}

// PrioritizeBug prioritizes a bug using AI
func (s *BugTrackingService) PrioritizeBug(ctx context.Context, bugID string) (*BugPriority, error) {
	path := fmt.Sprintf("/api/v1/bugs/%s/prioritize", bugID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var priority BugPriority
	if err := json.NewDecoder(resp.Body).Decode(&priority); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &priority, nil
}

// BatchPrioritize prioritizes multiple bugs
func (s *BugTrackingService) BatchPrioritize(ctx context.Context, bugIDs []string) ([]*BugPriority, error) {
	req := &BatchPrioritizeRequest{BugIDs: bugIDs}
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/bugs/batch-prioritize", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var priorities []*BugPriority
	if err := json.NewDecoder(resp.Body).Decode(&priorities); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return priorities, nil
}

// ========================================
// Bug Assignment
// ========================================

// AssignBug assigns a bug to a user or team
func (s *BugTrackingService) AssignBug(ctx context.Context, bugID string, req *AssignBugRequest) (*BugAssignment, error) {
	path := fmt.Sprintf("/api/v1/bugs/%s/assign", bugID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var assignment BugAssignment
	if err := json.NewDecoder(resp.Body).Decode(&assignment); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &assignment, nil
}

// AutoAssignBug automatically assigns a bug
func (s *BugTrackingService) AutoAssignBug(ctx context.Context, bugID string) (*BugAssignment, error) {
	path := fmt.Sprintf("/api/v1/bugs/%s/auto-assign", bugID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var assignment BugAssignment
	if err := json.NewDecoder(resp.Body).Decode(&assignment); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &assignment, nil
}

// GetAssignments retrieves assignments for a bug
func (s *BugTrackingService) GetAssignments(ctx context.Context, bugID string) ([]BugAssignment, error) {
	path := fmt.Sprintf("/api/v1/bugs/%s/assignments", bugID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var assignments []BugAssignment
	if err := json.NewDecoder(resp.Body).Decode(&assignments); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return assignments, nil
}

// ========================================
// Bug Status and Workflow
// ========================================

// UpdateBugStatus updates bug status
func (s *BugTrackingService) UpdateBugStatus(ctx context.Context, bugID string, req *UpdateBugStatusRequest) (*Bug, error) {
	path := fmt.Sprintf("/api/v1/bugs/%s/status", bugID)
	resp, err := s.client.doRequest(ctx, http.MethodPut, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var bug Bug
	if err := json.NewDecoder(resp.Body).Decode(&bug); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &bug, nil
}

// TransitionBug transitions bug through workflow
func (s *BugTrackingService) TransitionBug(ctx context.Context, bugID string, req *TransitionBugRequest) (*BugTransition, error) {
	path := fmt.Sprintf("/api/v1/bugs/%s/transition", bugID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var transition BugTransition
	if err := json.NewDecoder(resp.Body).Decode(&transition); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &transition, nil
}

// GetWorkflow retrieves workflow configuration
func (s *BugTrackingService) GetWorkflow(ctx context.Context, workflowID string) (*BugWorkflow, error) {
	path := fmt.Sprintf("/api/v1/bugs/workflows/%s", workflowID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var workflow BugWorkflow
	if err := json.NewDecoder(resp.Body).Decode(&workflow); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &workflow, nil
}

// ========================================
// Bug Tracking and Metrics
// ========================================

// GetBugMetrics retrieves bug metrics
func (s *BugTrackingService) GetBugMetrics(ctx context.Context, opts *BugMetricsOptions) (*BugMetrics, error) {
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, "/api/v1/bugs/metrics", nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var metrics BugMetrics
	if err := json.NewDecoder(resp.Body).Decode(&metrics); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &metrics, nil
}

// GetBugTrends retrieves bug trends
func (s *BugTrackingService) GetBugTrends(ctx context.Context, opts *BugTrendOptions) (*BugTrendReport, error) {
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, "/api/v1/bugs/trends", nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var report BugTrendReport
	if err := json.NewDecoder(resp.Body).Decode(&report); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &report, nil
}

// GetTeamPerformance retrieves team performance metrics
func (s *BugTrackingService) GetTeamPerformance(ctx context.Context, teamID string, timeRange *TimestampRange) (*TeamPerformance, error) {
	path := fmt.Sprintf("/api/v1/bugs/teams/%s/performance", teamID)
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, path, nil, map[string]interface{}{
		"timeRange": timeRange,
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var performance TeamPerformance
	if err := json.NewDecoder(resp.Body).Decode(&performance); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &performance, nil
}

// ========================================
// Bug Resolution
// ========================================

// ResolveBug resolves a bug
func (s *BugTrackingService) ResolveBug(ctx context.Context, bugID string, req *ResolveBugRequest) (*BugResolution, error) {
	path := fmt.Sprintf("/api/v1/bugs/%s/resolve", bugID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var resolution BugResolution
	if err := json.NewDecoder(resp.Body).Decode(&resolution); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &resolution, nil
}

// VerifyBug verifies a bug fix
func (s *BugTrackingService) VerifyBug(ctx context.Context, bugID string, req *VerifyBugRequest) (*BugVerification, error) {
	path := fmt.Sprintf("/api/v1/bugs/%s/verify", bugID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var verification BugVerification
	if err := json.NewDecoder(resp.Body).Decode(&verification); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &verification, nil
}

// CloseBug closes a bug
func (s *BugTrackingService) CloseBug(ctx context.Context, bugID string, req *CloseBugRequest) (*Bug, error) {
	path := fmt.Sprintf("/api/v1/bugs/%s/close", bugID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var bug Bug
	if err := json.NewDecoder(resp.Body).Decode(&bug); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &bug, nil
}

// ReopenBug reopens a closed bug
func (s *BugTrackingService) ReopenBug(ctx context.Context, bugID string, req *ReopenBugRequest) (*Bug, error) {
	path := fmt.Sprintf("/api/v1/bugs/%s/reopen", bugID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var bug Bug
	if err := json.NewDecoder(resp.Body).Decode(&bug); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &bug, nil
}

// ========================================
// Bug Relationships
// ========================================

// LinkBugs links bugs together
func (s *BugTrackingService) LinkBugs(ctx context.Context, bugID, relatedBugID string, linkType string) (*BugLink, error) {
	path := fmt.Sprintf("/api/v1/bugs/%s/links", bugID)
	req := &LinkBugRequest{
		RelatedBugID: relatedBugID,
		LinkType:     linkType,
	}
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var link BugLink
	if err := json.NewDecoder(resp.Body).Decode(&link); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &link, nil
}

// GetRelatedBugs retrieves related bugs
func (s *BugTrackingService) GetRelatedBugs(ctx context.Context, bugID string) ([]Bug, error) {
	path := fmt.Sprintf("/api/v1/bugs/%s/related", bugID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var bugs []Bug
	if err := json.NewDecoder(resp.Body).Decode(&bugs); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return bugs, nil
}

// ========================================
// Bug Notifications
// ========================================

// CreateNotification creates a bug notification
func (s *BugTrackingService) CreateNotification(ctx context.Context, bugID string, req *CreateBugNotificationRequest) (*BugNotification, error) {
	path := fmt.Sprintf("/api/v1/bugs/%s/notifications", bugID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var notification BugNotification
	if err := json.NewDecoder(resp.Body).Decode(&notification); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &notification, nil
}

// GetNotifications retrieves notifications for a bug
func (s *BugTrackingService) GetNotifications(ctx context.Context, bugID string, opts *ListOptions) (*PaginatedResponse[BugNotification], error) {
	path := fmt.Sprintf("/api/v1/bugs/%s/notifications", bugID)
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, path, nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var response PaginatedResponse[BugNotification]
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// SubscribeToBug subscribes to bug updates
func (s *BugTrackingService) SubscribeToBug(ctx context.Context, bugID string, req *SubscribeBugRequest) error {
	path := fmt.Sprintf("/api/v1/bugs/%s/subscribe", bugID)
	_, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	return err
}

// UnsubscribeFromBug unsubscribes from bug updates
func (s *BugTrackingService) UnsubscribeFromBug(ctx context.Context, bugID, userID string) error {
	path := fmt.Sprintf("/api/v1/bugs/%s/unsubscribe", bugID)
	req := &UnsubscribeBugRequest{UserID: userID}
	_, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	return err
}

// ========================================
// Bug Automation
// ========================================

// CreateAutomation creates bug automation rule
func (s *BugTrackingService) CreateAutomation(ctx context.Context, req *CreateBugAutomationRequest) (*BugAutomation, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/bugs/automation", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var automation BugAutomation
	if err := json.NewDecoder(resp.Body).Decode(&automation); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &automation, nil
}

// GetAutomation retrieves automation rule
func (s *BugTrackingService) GetAutomation(ctx context.Context, automationID string) (*BugAutomation, error) {
	path := fmt.Sprintf("/api/v1/bugs/automation/%s", automationID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var automation BugAutomation
	if err := json.NewDecoder(resp.Body).Decode(&automation); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &automation, nil
}

// ListAutomation lists automation rules
func (s *BugTrackingService) ListAutomation(ctx context.Context, opts *ListOptions) (*PaginatedResponse[BugAutomation], error) {
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, "/api/v1/bugs/automation", nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var response PaginatedResponse[BugAutomation]
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// EnableAutomation enables an automation rule
func (s *BugTrackingService) EnableAutomation(ctx context.Context, automationID string) error {
	path := fmt.Sprintf("/api/v1/bugs/automation/%s/enable", automationID)
	_, err := s.client.doRequest(ctx, http.MethodPost, path, nil)
	return err
}

// DisableAutomation disables an automation rule
func (s *BugTrackingService) DisableAutomation(ctx context.Context, automationID string) error {
	path := fmt.Sprintf("/api/v1/bugs/automation/%s/disable", automationID)
	_, err := s.client.doRequest(ctx, http.MethodPost, path, nil)
	return err
}

// TestAutomation tests an automation rule
func (s *BugTrackingService) TestAutomation(ctx context.Context, automationID string, req *TestAutomationRequest) (*AutomationTestResult, error) {
	path := fmt.Sprintf("/api/v1/bugs/automation/%s/test", automationID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result AutomationTestResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// BatchPrioritizeRequest represents a request to batch prioritize bugs
type BatchPrioritizeRequest struct {
	BugIDs []string `json:"bug_ids"`
}

// LinkBugRequest represents a request to link bugs together
type LinkBugRequest struct {
	RelatedBugID string `json:"related_bug_id"`
	LinkType     string `json:"link_type"`
}

// UnsubscribeBugRequest represents a request to unsubscribe from bug updates
type UnsubscribeBugRequest struct {
	UserID string `json:"user_id"`
}
