package sdln

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

// ========================================
// Beta Testing Service
// ========================================

// BetaTestingService handles beta testing program management
type BetaTestingService struct {
	client *Client
}

// NewBetaTestingService creates a new beta testing service
func NewBetaTestingService(client *Client) *BetaTestingService {
	return &BetaTestingService{client: client}
}

// ========================================
// Program Management
// ========================================

// CreateProgram creates a new beta testing program
func (s *BetaTestingService) CreateProgram(ctx context.Context, req *CreateBetaProgramRequest) (*BetaProgram, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/beta/programs", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var program BetaProgram
	if err := json.NewDecoder(resp.Body).Decode(&program); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &program, nil
}

// GetProgram retrieves a beta testing program
func (s *BetaTestingService) GetProgram(ctx context.Context, programID string) (*BetaProgram, error) {
	path := fmt.Sprintf("/api/v1/beta/programs/%s", programID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var program BetaProgram
	if err := json.NewDecoder(resp.Body).Decode(&program); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &program, nil
}

// ListPrograms lists all beta testing programs
func (s *BetaTestingService) ListPrograms(ctx context.Context, opts *ListOptions) (*PaginatedResponse[BetaProgram], error) {
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, "/api/v1/beta/programs", nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var response PaginatedResponse[BetaProgram]
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// UpdateProgram updates a beta testing program
func (s *BetaTestingService) UpdateProgram(ctx context.Context, programID string, req *UpdateBetaProgramRequest) (*BetaProgram, error) {
	path := fmt.Sprintf("/api/v1/beta/programs/%s", programID)
	resp, err := s.client.doRequest(ctx, http.MethodPut, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var program BetaProgram
	if err := json.NewDecoder(resp.Body).Decode(&program); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &program, nil
}

// DeleteProgram deletes a beta testing program
func (s *BetaTestingService) DeleteProgram(ctx context.Context, programID string) error {
	path := fmt.Sprintf("/api/v1/beta/programs/%s", programID)
	_, err := s.client.doRequest(ctx, http.MethodDelete, path, nil)
	return err
}

// ========================================
// Beta User Management
// ========================================

// InviteUser invites a user to the beta program
func (s *BetaTestingService) InviteUser(ctx context.Context, programID string, req *InviteBetaUserRequest) (*BetaUserInvitation, error) {
	path := fmt.Sprintf("/api/v1/beta/programs/%s/invitations", programID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var invitation BetaUserInvitation
	if err := json.NewDecoder(resp.Body).Decode(&invitation); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &invitation, nil
}

// AcceptInvitation accepts a beta program invitation
func (s *BetaTestingService) AcceptInvitation(ctx context.Context, invitationToken string) (*BetaUser, error) {
	req := &AcceptInvitationRequest{Token: invitationToken}
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/beta/invitations/accept", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var user BetaUser
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &user, nil
}

// GetBetaUser retrieves a beta user
func (s *BetaTestingService) GetBetaUser(ctx context.Context, userID string) (*BetaUser, error) {
	path := fmt.Sprintf("/api/v1/beta/users/%s", userID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var user BetaUser
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &user, nil
}

// ListBetaUsers lists all beta users in a program
func (s *BetaTestingService) ListBetaUsers(ctx context.Context, programID string, opts *BetaUserListOptions) (*PaginatedResponse[BetaUser], error) {
	path := fmt.Sprintf("/api/v1/beta/programs/%s/users", programID)
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, path, nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var response PaginatedResponse[BetaUser]
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// UpdateBetaUser updates a beta user
func (s *BetaTestingService) UpdateBetaUser(ctx context.Context, userID string, req *UpdateBetaUserRequest) (*BetaUser, error) {
	path := fmt.Sprintf("/api/v1/beta/users/%s", userID)
	resp, err := s.client.doRequest(ctx, http.MethodPut, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var user BetaUser
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &user, nil
}

// RemoveFromProgram removes a user from a beta program
func (s *BetaTestingService) RemoveFromProgram(ctx context.Context, programID, userID string, reason string) error {
	path := fmt.Sprintf("/api/v1/beta/programs/%s/users/%s", programID, userID)
	req := &RemoveFromProgramRequest{Reason: reason}
	_, err := s.client.doRequest(ctx, http.MethodDelete, path, req)
	return err
}

// ========================================
// Testing Scenarios
// ========================================

// CreateTestScenario creates a new test scenario
func (s *BetaTestingService) CreateTestScenario(ctx context.Context, programID string, req *CreateTestScenarioRequest) (*TestScenario, error) {
	path := fmt.Sprintf("/api/v1/beta/programs/%s/scenarios", programID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var scenario TestScenario
	if err := json.NewDecoder(resp.Body).Decode(&scenario); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &scenario, nil
}

// GetTestScenario retrieves a test scenario
func (s *BetaTestingService) GetTestScenario(ctx context.Context, scenarioID string) (*TestScenario, error) {
	path := fmt.Sprintf("/api/v1/beta/scenarios/%s", scenarioID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var scenario TestScenario
	if err := json.NewDecoder(resp.Body).Decode(&scenario); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &scenario, nil
}

// ListTestScenarios lists all test scenarios in a program
func (s *BetaTestingService) ListTestScenarios(ctx context.Context, programID string, opts *ListOptions) (*PaginatedResponse[TestScenario], error) {
	path := fmt.Sprintf("/api/v1/beta/programs/%s/scenarios", programID)
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, path, nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var response PaginatedResponse[TestScenario]
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// AssignScenario assigns a test scenario to users
func (s *BetaTestingService) AssignScenario(ctx context.Context, scenarioID string, req *AssignScenarioRequest) error {
	path := fmt.Sprintf("/api/v1/beta/scenarios/%s/assign", scenarioID)
	_, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	return err
}

// ========================================
// Progress Tracking
// ========================================

// GetProgress retrieves user's testing progress
func (s *BetaTestingService) GetProgress(ctx context.Context, userID, programID string) (*BetaTestingProgress, error) {
	path := fmt.Sprintf("/api/v1/beta/users/%s/programs/%s/progress", userID, programID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var progress BetaTestingProgress
	if err := json.NewDecoder(resp.Body).Decode(&progress); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &progress, nil
}

// UpdateProgress updates testing progress
func (s *BetaTestingService) UpdateProgress(ctx context.Context, userID, programID string, req *UpdateProgressRequest) (*BetaTestingProgress, error) {
	path := fmt.Sprintf("/api/v1/beta/users/%s/programs/%s/progress", userID, programID)
	resp, err := s.client.doRequest(ctx, http.MethodPut, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var progress BetaTestingProgress
	if err := json.NewDecoder(resp.Body).Decode(&progress); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &progress, nil
}

// GetProgramAnalytics retrieves program analytics
func (s *BetaTestingService) GetProgramAnalytics(ctx context.Context, programID string, timeRange *TimestampRange) (*BetaProgramAnalytics, error) {
	path := fmt.Sprintf("/api/v1/beta/programs/%s/analytics", programID)
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, path, nil, map[string]interface{}{
		"timeRange": timeRange,
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var analytics BetaProgramAnalytics
	if err := json.NewDecoder(resp.Body).Decode(&analytics); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &analytics, nil
}

// ========================================
// Rewards and Gamification
// ========================================

// GetRewards retrieves available rewards
func (s *BetaTestingService) GetRewards(ctx context.Context, programID string) ([]BetaReward, error) {
	path := fmt.Sprintf("/api/v1/beta/programs/%s/rewards", programID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var rewards []BetaReward
	if err := json.NewDecoder(resp.Body).Decode(&rewards); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return rewards, nil
}

// RedeemReward redeems a reward
func (s *BetaTestingService) RedeemReward(ctx context.Context, userID, programID, rewardID string) (*BetaRewardRedemption, error) {
	path := fmt.Sprintf("/api/v1/beta/users/%s/programs/%s/rewards/%s/redeem", userID, programID, rewardID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var redemption BetaRewardRedemption
	if err := json.NewDecoder(resp.Body).Decode(&redemption); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &redemption, nil
}

// GetLeaderboard retrieves the program leaderboard
func (s *BetaTestingService) GetLeaderboard(ctx context.Context, programID string, opts *LeaderboardOptions) (*BetaLeaderboard, error) {
	path := fmt.Sprintf("/api/v1/beta/programs/%s/leaderboard", programID)
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, path, nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var leaderboard BetaLeaderboard
	if err := json.NewDecoder(resp.Body).Decode(&leaderboard); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &leaderboard, nil
}

// ========================================
// Program Completion
// ========================================

// GraduateBeta graduates a user from beta program
func (s *BetaTestingService) GraduateBeta(ctx context.Context, userID, programID string, req *GraduationRequest) (*BetaGraduation, error) {
	path := fmt.Sprintf("/api/v1/beta/users/%s/programs/%s/graduate", userID, programID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var graduation BetaGraduation
	if err := json.NewDecoder(resp.Body).Decode(&graduation); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &graduation, nil
}

// GetGraduationStatus retrieves graduation status
func (s *BetaTestingService) GetGraduationStatus(ctx context.Context, userID, programID string) (*BetaGraduationStatus, error) {
	path := fmt.Sprintf("/api/v1/beta/users/%s/programs/%s/graduation-status", userID, programID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var status BetaGraduationStatus
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &status, nil
}
