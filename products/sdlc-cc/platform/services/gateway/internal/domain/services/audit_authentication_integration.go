package services

import (
	"context"
	"net"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/monitoring"
)

// AuditAuthenticatedService wraps AuthenticationService to add audit logging
type AuditAuthenticatedService struct {
	authService interface {
		Authenticate(ctx context.Context, req *AuthenticationRequest) (*AuthenticationResponse, error)
		Logout(ctx context.Context, sessionToken string) error
		RefreshToken(ctx context.Context, refreshToken string) (*TokenPair, error)
		ChangePassword(ctx context.Context, req *PasswordChangeRequest) error
	}
	auditService AuditService
	metrics      AuditMetrics
	tracer       *monitoring.AuditTraceHelper
	logger       *logrus.Logger
}

// NewAuditAuthenticatedService creates a new audit-wrapped authentication service
func NewAuditAuthenticatedService(
	authService interface {
		Authenticate(ctx context.Context, req *AuthenticationRequest) (*AuthenticationResponse, error)
		Logout(ctx context.Context, sessionToken string) error
		RefreshToken(ctx context.Context, refreshToken string) (*TokenPair, error)
		ChangePassword(ctx context.Context, req *PasswordChangeRequest) error
	},
	auditService AuditService,
	metrics AuditMetrics,
	tracer *monitoring.AuditTraceHelper,
	logger *logrus.Logger,
) *AuditAuthenticatedService {
	if logger == nil {
		logger = logrus.New()
	}

	return &AuditAuthenticatedService{
		authService:  authService,
		auditService: auditService,
		metrics:      metrics,
		tracer:       tracer,
		logger:       logger,
	}
}

// Authenticate wraps the authentication call with audit logging
func (s *AuditAuthenticatedService) Authenticate(ctx context.Context, email string, password string, tenantID uuid.UUID, ipAddress net.IP, userAgent string, deviceFingerprint string) (*AuthenticationResponse, error) {
	// Create auth event placeholder
	authEvent := AuthEvent{
		TenantID:          tenantID,
		UserID:            uuid.Nil, // Will be filled after auth
		EventType:         "login",
		IPAddress:         ipAddress,
		UserAgent:         userAgent,
		DeviceFingerprint: deviceFingerprint,
		Timestamp:         s.now(),
	}

	// Start tracing
	finishTrace := s.tracer.TraceAuthOperation(ctx, "login")
	defer func() {
		finishTrace(authEvent.Success, nil)
	}()

	// Record attempt
	if s.metrics != nil {
		s.metrics.RecordAuthAttempt(tenantID.String(), "password")
	}

	// Call the actual authentication
	req := &AuthenticationRequest{
		Email:             email,
		Password:          password,
		DeviceFingerprint: deviceFingerprint,
		UserAgent:         userAgent,
		IPAddress:         ipAddress.String(),
	}

	response, err := s.authService.Authenticate(ctx, req)

	if err != nil {
		// Failed authentication
		authEvent.Success = false
		authEvent.FailureReason = err.Error()

		// Log failed attempt
		if auditErr := s.auditService.LogAuthentication(ctx, authEvent); auditErr != nil {
			s.logger.WithError(auditErr).Error("Failed to log authentication failure")
		}

		// Record failure metric
		if s.metrics != nil {
			s.metrics.RecordAuthFailure(tenantID.String(), "password", authEvent.FailureReason)
		}

		return nil, err
	}

	// Successful authentication
	authEvent.UserID = response.User.ID
	authEvent.Success = true
	authEvent.LoginMethod = "password"
	authEvent.MFAUsed = response.User.MFAEnabled
	authEvent.SessionID = response.SessionID

	// Log successful authentication
	if auditErr := s.auditService.LogAuthentication(ctx, authEvent); auditErr != nil {
		s.logger.WithError(auditErr).Error("Failed to log authentication success")
	}

	// Record success metric
	if s.metrics != nil {
		s.metrics.RecordAuthSuccess(tenantID.String(), "password", authEvent.MFAUsed)
	}

	return response, nil
}

// Logout wraps logout with audit logging
func (s *AuditAuthenticatedService) Logout(ctx context.Context, userID uuid.UUID, tenantID uuid.UUID, sessionToken string, ipAddress net.IP, userAgent string) error {
	// Create logout event
	authEvent := AuthEvent{
		TenantID:  tenantID,
		UserID:    userID,
		EventType: "logout",
		Success:   true,
		IPAddress: ipAddress,
		UserAgent: userAgent,
		Timestamp: s.now(),
	}

	// Start tracing
	finishTrace := s.tracer.TraceAuthOperation(ctx, "logout")
	defer func() {
		finishTrace(true, nil)
	}()

	// Call the actual logout
	err := s.authService.Logout(ctx, sessionToken)

	// Log the logout attempt regardless of result
	if auditErr := s.auditService.LogAuthentication(ctx, authEvent); auditErr != nil {
		s.logger.WithError(auditErr).Error("Failed to log logout")
	}

	return err
}

// RefreshToken wraps token refresh with audit logging
func (s *AuditAuthenticatedService) RefreshToken(ctx context.Context, refreshToken string, ipAddress net.IP, userAgent string) (*TokenPair, error) {
	// Start tracing
	finishTrace := s.tracer.TraceAuthOperation(ctx, "token_refresh")
	defer func() {
		finishTrace(true, nil)
	}()

	// Call the actual refresh
	tokenPair, err := s.authService.RefreshToken(ctx, refreshToken)

	// We can't log full details here without parsing the token first,
	// but the service itself may have internal logging
	if err != nil {
		if s.metrics != nil {
			s.metrics.RecordAuthFailure("unknown", "refresh", err.Error())
		}
		return nil, err
	}

	if s.metrics != nil {
		s.metrics.RecordAuthSuccess("unknown", "refresh", false)
	}

	return tokenPair, nil
}

// ChangePassword wraps password change with audit logging
func (s *AuditAuthenticatedService) ChangePassword(ctx context.Context, userID uuid.UUID, tenantID uuid.UUID, currentPassword, newPassword string, ipAddress net.IP, userAgent string) error {
	// Start tracing
	finishTrace := s.tracer.TraceAuthOperation(ctx, "password_change")
	defer func() {
		finishTrace(true, nil)
	}()

	// Create password change request
	req := &PasswordChangeRequest{
		CurrentPassword: currentPassword,
		NewPassword:     newPassword,
		ConfirmPassword: newPassword,
	}

	// Call the actual password change
	err := s.authService.ChangePassword(ctx, req)

	// Create auth event for logging
	authEvent := AuthEvent{
		TenantID:  tenantID,
		UserID:    userID,
		EventType: "password_change",
		IPAddress: ipAddress,
		UserAgent: userAgent,
		Timestamp: s.now(),
	}

	if err != nil {
		// Log failed password change
		authEvent.Success = false
		authEvent.FailureReason = err.Error()
		_ = s.auditService.LogAuthentication(ctx, authEvent)
		return err
	}

	// Log successful password change
	authEvent.Success = true
	_ = s.auditService.LogAuthentication(ctx, authEvent)

	return nil
}

// now returns the current time
func (s *AuditAuthenticatedService) now() time.Time {
	return time.Now()
}

// AuditAuthorizationService wraps authorization checks with audit logging
type AuditAuthorizationService struct {
	policyService interface {
		EvaluateUserPermission(ctx context.Context, tenantID, userID uuid.UUID, resourceType, resourceID, action string) (bool, string, error)
	}
	auditService AuditService
	metrics      AuditMetrics
	tracer       *monitoring.AuditTraceHelper
	logger       *logrus.Logger
}

// NewAuditAuthorizationService creates a new audit-wrapped authorization service
func NewAuditAuthorizationService(
	policyService interface {
		EvaluateUserPermission(ctx context.Context, tenantID, userID uuid.UUID, resourceType, resourceID, action string) (bool, string, error)
	},
	auditService AuditService,
	metrics AuditMetrics,
	tracer *monitoring.AuditTraceHelper,
	logger *logrus.Logger,
) *AuditAuthorizationService {
	if logger == nil {
		logger = logrus.New()
	}

	return &AuditAuthorizationService{
		policyService: policyService,
		auditService:  auditService,
		metrics:       metrics,
		tracer:        tracer,
		logger:        logger,
	}
}

// CheckPermission wraps permission check with audit logging
func (s *AuditAuthorizationService) CheckPermission(ctx context.Context, userID, tenantID uuid.UUID, resourceType, resourceID, action string, ipAddress net.IP, userAgent string) (bool, string, error) {
	// Create authz event
	authzEvent := AuthzEvent{
		TenantID:     tenantID,
		UserID:       userID,
		ResourceType: resourceType,
		Action:       action,
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
		Timestamp:    s.now(),
	}

	if resourceID != "" {
		if id, err := uuid.Parse(resourceID); err == nil {
			authzEvent.ResourceID = id
		}
	}

	// Start tracing
	finishTrace := s.tracer.TraceAuthzOperation(ctx, resourceType, action)

	// Record check metric
	if s.metrics != nil {
		s.metrics.RecordAuthzCheck(tenantID.String(), resourceType, action)
	}

	// Call the actual policy check
	granted, reason, err := s.policyService.EvaluateUserPermission(ctx, tenantID, userID, resourceType, resourceID, action)

	if err != nil {
		authzEvent.Decision = "deny"
		authzEvent.DeniedReason = err.Error()
		finishTrace(false, authzEvent.DeniedReason)
		_ = s.auditService.LogAuthorization(ctx, authzEvent)
		return false, reason, err
	}

	if granted {
		authzEvent.Decision = "allow"
		finishTrace(true, "")
		if s.metrics != nil {
			s.metrics.RecordAuthzGranted(tenantID.String(), resourceType, action)
		}
	} else {
		authzEvent.Decision = "deny"
		authzEvent.DeniedReason = reason
		finishTrace(false, reason)
		if s.metrics != nil {
			s.metrics.RecordAuthzDenied(tenantID.String(), resourceType, action, reason)
		}
	}

	// Log the authorization decision
	_ = s.auditService.LogAuthorization(ctx, authzEvent)

	return granted, reason, nil
}

// now returns the current time
func (s *AuditAuthorizationService) now() time.Time {
	return time.Now()
}
