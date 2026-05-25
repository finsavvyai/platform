package sdln

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"strings"
	"sync"
	"time"
)

// ZeroTrustService provides zero-trust runtime enforcement
type ZeroTrustService struct {
	*BaseService
	certManager     *CertificateManager
	policyValidator *RuntimePolicyValidator
	dataEnforcer    *DataResidencyEnforcer
	requestSigner   *RequestSigner
	auditLogger     *ZeroTrustAuditLogger
	config          *ZeroTrustConfig
	mu              sync.RWMutex
}

// ZeroTrustConfig holds configuration for zero-trust enforcement
type ZeroTrustConfig struct {
	EnableMutualTLS         bool          `json:"enable_mutual_tls"`
	RequireRequestSigning   bool          `json:"require_request_signing"`
	StrictPolicyValidation  bool          `json:"strict_policy_validation"`
	EnforceDataResidency    bool          `json:"enforce_data_residency"`
	MaxSessionDuration      time.Duration `json:"max_session_duration"`
	TokenRotationInterval   time.Duration `json:"token_rotation_interval"`
	AllowedRegions          []string      `json:"allowed_regions"`
	BlockedRegions          []string      `json:"blocked_regions"`
	RequireGeoVerification  bool          `json:"require_geo_verification"`
	EnableDeviceFingerprint bool          `json:"enable_device_fingerprint"`
	MaxFailedAttempts       int           `json:"max_failed_attempts"`
	LockoutDuration         time.Duration `json:"lockout_duration"`
}

// NewZeroTrustService creates a new zero-trust service
func NewZeroTrustService(client *Client) *ZeroTrustService {
	service := &ZeroTrustService{
		BaseService: NewBaseService(client, "zero-trust", "api/v1/zero-trust"),
		config: &ZeroTrustConfig{
			EnableMutualTLS:         true,
			RequireRequestSigning:   true,
			StrictPolicyValidation:  true,
			EnforceDataResidency:    true,
			MaxSessionDuration:      time.Hour,
			TokenRotationInterval:   time.Minute * 30,
			AllowedRegions:          []string{"US", "EU", "CA", "GB", "AU", "JP"},
			BlockedRegions:          []string{"CN", "RU", "IR", "KP"},
			RequireGeoVerification:  true,
			EnableDeviceFingerprint: true,
			MaxFailedAttempts:       5,
			LockoutDuration:         time.Minute * 15,
		},
	}

	// Initialize components
	service.certManager = NewCertificateManager()
	service.policyValidator = NewRuntimePolicyValidator(client)
	service.dataEnforcer = NewDataResidencyEnforcer(client)
	service.requestSigner = NewRequestSigner()
	service.auditLogger = NewZeroTrustAuditLogger(client)

	return service
}

// EnforceTrust enforces zero-trust policies for a request
func (s *ZeroTrustService) EnforceTrust(ctx context.Context, request *TrustRequest) (*TrustResult, error) {
	startTime := time.Now()

	result := &TrustResult{
		RequestID:    generateID(),
		Trusted:      false,
		RiskLevel:    "unknown",
		Violations:   []TrustViolation{},
		Enforcements: []TrustEnforcement{},
		Metadata:     make(map[string]interface{}),
	}

	// Step 1: Certificate validation
	if s.config.EnableMutualTLS {
		certResult := s.certManager.ValidateCertificate(request.Certificate, request.TLSSecret)
		if !certResult.Valid {
			result.Trusted = false
			result.RiskLevel = "critical"
			result.Violations = append(result.Violations, TrustViolation{
				Type:        "certificate_invalid",
				Description: certResult.Reason,
				Severity:    "critical",
			})
			s.auditLogger.LogViolation(ctx, result.RequestID, "certificate_invalid", certResult.Reason)
			return result, nil
		}
		result.Metadata["certificate_valid"] = true
		result.Metadata["certificate_subject"] = certResult.Subject
	}

	// Step 2: Request signature validation
	if s.config.RequireRequestSigning {
		sigResult := s.requestSigner.ValidateSignature(request)
		if !sigResult.Valid {
			result.Trusted = false
			result.RiskLevel = "high"
			result.Violations = append(result.Violations, TrustViolation{
				Type:        "signature_invalid",
				Description: sigResult.Reason,
				Severity:    "high",
			})
			s.auditLogger.LogViolation(ctx, result.RequestID, "signature_invalid", sigResult.Reason)
			return result, nil
		}
		result.Metadata["signature_valid"] = true
		result.Metadata["signer_id"] = sigResult.SignerID
	}

	// Step 3: Runtime policy validation
	policyResult, err := s.policyValidator.ValidatePolicies(ctx, request)
	if err != nil {
		return nil, err
	}

	if !policyResult.Compliant {
		result.Trusted = false
		result.RiskLevel = "high"
		for _, violation := range policyResult.Violations {
			result.Violations = append(result.Violations, TrustViolation{
				Type:        "policy_violation",
				Description: violation.Description,
				Severity:    violation.Severity,
				PolicyID:    violation.PolicyID,
			})
		}
		s.auditLogger.LogViolation(ctx, result.RequestID, "policy_violation", fmt.Sprintf("%d policy violations", len(policyResult.Violations)))
		return result, nil
	}
	result.Metadata["policy_compliant"] = true

	// Step 4: Data residency enforcement
	if s.config.EnforceDataResidency {
		residencyResult := s.dataEnforcer.EnforceResidency(ctx, request)
		if !residencyResult.Compliant {
			result.Trusted = false
			result.RiskLevel = "critical"
			result.Violations = append(result.Violations, TrustViolation{
				Type:        "data_residency_violation",
				Description: residencyResult.Reason,
				Severity:    "critical",
			})
			s.auditLogger.LogViolation(ctx, result.RequestID, "data_residency_violation", residencyResult.Reason)
			return result, nil
		}
		result.Metadata["data_residency_compliant"] = true
		result.Metadata["data_region"] = residencyResult.Region
	}

	// Step 5: Geographic verification
	if s.config.RequireGeoVerification {
		geoResult := s.verifyGeolocation(ctx, request)
		if !geoResult.Allowed {
			result.Trusted = false
			result.RiskLevel = "high"
			result.Violations = append(result.Violations, TrustViolation{
				Type:        "geo_violation",
				Description: fmt.Sprintf("Access from blocked region: %s", geoResult.Country),
				Severity:    "high",
			})
			s.auditLogger.LogViolation(ctx, result.RequestID, "geo_violation", fmt.Sprintf("Country: %s", geoResult.Country))
			return result, nil
		}
		result.Metadata["geo_verified"] = true
		result.Metadata["country"] = geoResult.Country
	}

	// Step 6: Device fingerprint verification
	if s.config.EnableDeviceFingerprint {
		deviceResult := s.verifyDevice(ctx, request)
		if !deviceResult.Trusted {
			result.Trusted = false
			result.RiskLevel = "medium"
			result.Violations = append(result.Violations, TrustViolation{
				Type:        "device_untrusted",
				Description: "Unrecognized or suspicious device",
				Severity:    "medium",
			})
			s.auditLogger.LogViolation(ctx, result.RequestID, "device_untrusted", "Device fingerprint mismatch")
		}
		result.Metadata["device_trusted"] = deviceResult.Trusted
		if deviceResult.DeviceID != "" {
			result.Metadata["device_id"] = deviceResult.DeviceID
		}
	}

	// Step 7: Rate limiting and anomaly detection
	anomalyResult := s.detectAnomalies(ctx, request)
	if anomalyResult.Score > 0.7 {
		result.RiskLevel = "high"
		result.Violations = append(result.Violations, TrustViolation{
			Type:        "anomaly_detected",
			Description: fmt.Sprintf("Anomaly score: %.2f", anomalyResult.Score),
			Severity:    "high",
		})
		s.auditLogger.LogViolation(ctx, result.RequestID, "anomaly_detected", fmt.Sprintf("Score: %.2f", anomalyResult.Score))
	}

	// Step 8: Apply security enforcements
	if result.Trusted || len(result.Violations) == 0 {
		result.Trusted = true
		result.RiskLevel = "low"

		// Apply security headers
		result.Enforcements = append(result.Enforcements, TrustEnforcement{
			Type: "security_headers",
			Value: map[string]interface{}{
				"strict_transport_security": "max-age=31536000; includeSubDomains",
				"x_content_type_options":    "nosniff",
				"x_frame_options":           "DENY",
				"x_xss_protection":          "1; mode=block",
			},
		})

		// Apply content security policy
		result.Enforcements = append(result.Enforcements, TrustEnforcement{
			Type:  "csp",
			Value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
		})

		// Generate session token
		sessionToken, err := s.generateSessionToken(ctx, request)
		if err == nil {
			result.Enforcements = append(result.Enforcements, TrustEnforcement{
				Type:  "session_token",
				Value: sessionToken,
			})
			result.Metadata["session_expires"] = time.Now().Add(s.config.MaxSessionDuration)
		}
	}

	result.ProcessingTime = time.Since(startTime)
	result.CreatedAt = NewTimestamp(time.Now())

	// Log the enforcement
	s.auditLogger.LogEnforcement(ctx, result)

	return result, nil
}

// ValidateSession validates a session token
func (s *ZeroTrustService) ValidateSession(ctx context.Context, sessionToken string) (*SessionValidationResult, error) {
	result := &SessionValidationResult{
		Valid:    false,
		Reason:   "",
		Metadata: make(map[string]interface{}),
	}

	// Decode and validate token
	tokenData, err := s.decodeSessionToken(sessionToken)
	if err != nil {
		result.Reason = "Invalid token format"
		return result, nil
	}

	// Check expiration
	if time.Now().After(tokenData.ExpiresAt) {
		result.Reason = "Token expired"
		return result, nil
	}

	// Check if token is revoked
	if s.isTokenRevoked(ctx, tokenData.ID) {
		result.Reason = "Token revoked"
		return result, nil
	}

	// Validate device continuity
	if s.config.EnableDeviceFingerprint {
		if !s.validateDeviceContinuity(ctx, tokenData.DeviceID, tokenData.UserID) {
			result.Reason = "Device continuity violation"
			return result, nil
		}
	}

	// Check anomaly score
	anomalyScore := s.calculateSessionAnomaly(ctx, tokenData)
	if anomalyScore > 0.8 {
		result.Reason = "High anomaly score detected"
		return result, nil
	}

	result.Valid = true
	result.Metadata["user_id"] = tokenData.UserID
	result.Metadata["device_id"] = tokenData.DeviceID
	result.Metadata["expires_at"] = tokenData.ExpiresAt
	result.Metadata["anomaly_score"] = anomalyScore

	return result, nil
}

// RotateCertificates rotates mutual TLS certificates
func (s *ZeroTrustService) RotateCertificates(ctx context.Context) (*CertificateRotationResult, error) {
	result := &CertificateRotationResult{
		Rotated: false,
		Reason:  "",
	}

	if !s.config.EnableMutualTLS {
		result.Reason = "Mutual TLS is disabled"
		return result, nil
	}

	// Generate new certificate pair
	cert, key, err := s.certManager.GenerateCertificate()
	if err != nil {
		result.Reason = fmt.Sprintf("Certificate generation failed: %v", err)
		return result, nil
	}

	// Store new certificates
	err = s.certManager.StoreCertificates(ctx, cert, key)
	if err != nil {
		result.Reason = fmt.Sprintf("Certificate storage failed: %v", err)
		return result, nil
	}

	result.Rotated = true
	result.NewCertificateID = cert.ID
	result.RotationTime = NewTimestamp(time.Now())

	s.auditLogger.LogCertificateRotation(ctx, cert.ID)

	return result, nil
}

// Helper methods

func (s *ZeroTrustService) verifyGeolocation(ctx context.Context, request *TrustRequest) *GeoVerificationResult {
	result := &GeoVerificationResult{
		Allowed: true,
		Country: "US", // Default
	}

	// Extract country from request
	if request.ClientIP != "" {
		country := s.getCountryFromIP(request.ClientIP)
		result.Country = country

		// Check blocked regions
		for _, blocked := range s.config.BlockedRegions {
			if country == blocked {
				result.Allowed = false
				return result
			}
		}

		// Check allowed regions (if configured)
		if len(s.config.AllowedRegions) > 0 {
			allowed := false
			for _, allowedCountry := range s.config.AllowedRegions {
				if country == allowedCountry {
					allowed = true
					break
				}
			}
			result.Allowed = allowed
		}
	}

	return result
}

func (s *ZeroTrustService) verifyDevice(ctx context.Context, request *TrustRequest) *DeviceVerificationResult {
	result := &DeviceVerificationResult{
		Trusted:  false,
		DeviceID: "",
	}

	// Generate device fingerprint
	fingerprint := s.generateDeviceFingerprint(request)

	// Check if device is known
	deviceID, trusted := s.getDeviceTrust(ctx, fingerprint, request.UserID)

	result.DeviceID = deviceID
	result.Trusted = trusted

	// If device is new, create a record
	if deviceID == "" {
		newDeviceID := s.registerDevice(ctx, fingerprint, request.UserID)
		result.DeviceID = newDeviceID
		result.Trusted = false // New devices require additional verification
	}

	return result
}

func (s *ZeroTrustService) detectAnomalies(ctx context.Context, request *TrustRequest) *AnomalyDetectionResult {
	result := &AnomalyDetectionResult{
		Score: 0.0,
	}

	// Check for rapid successive requests
	if s.isRapidRequest(ctx, request.UserID, request.ClientIP) {
		result.Score += 0.3
	}

	// Check for unusual request patterns
	if s.hasUnusualPattern(ctx, request) {
		result.Score += 0.2
	}

	// Check for suspicious user agent
	if s.hasSuspiciousUserAgent(request.UserAgent) {
		result.Score += 0.2
	}

	// Check for impossible travel
	if s.hasImpossibleTravel(ctx, request) {
		result.Score += 0.5
	}

	return result
}

func (s *ZeroTrustService) generateSessionToken(ctx context.Context, request *TrustRequest) (string, error) {
	tokenData := &SessionTokenData{
		ID:        generateID(),
		UserID:    request.UserID,
		DeviceID:  request.DeviceFingerprint,
		CreatedAt: time.Now(),
		ExpiresAt: time.Now().Add(s.config.MaxSessionDuration),
	}

	// Serialize and sign token
	tokenJSON, err := json.Marshal(tokenData)
	if err != nil {
		return "", err
	}

	signature, err := s.requestSigner.Sign(tokenJSON)
	if err != nil {
		return "", err
	}

	// Combine token and signature
	token := base64.StdEncoding.EncodeToString(tokenJSON) + "." + base64.StdEncoding.EncodeToString(signature)

	// Store token for revocation checking
	s.storeSessionToken(ctx, tokenData)

	return token, nil
}

func (s *ZeroTrustService) decodeSessionToken(token string) (*SessionTokenData, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid token format")
	}

	tokenJSON, err := base64.StdEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, err
	}

	signature, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, err
	}

	// Verify signature
	if !s.requestSigner.Verify(tokenJSON, signature) {
		return nil, fmt.Errorf("invalid signature")
	}

	var tokenData SessionTokenData
	err = json.Unmarshal(tokenJSON, &tokenData)
	if err != nil {
		return nil, err
	}

	return &tokenData, nil
}

func (s *ZeroTrustService) isTokenRevoked(ctx context.Context, tokenID string) bool {
	// In production, check against a database or cache
	return false
}

func (s *ZeroTrustService) validateDeviceContinuity(ctx context.Context, deviceID, userID string) bool {
	// In production, validate device hasn't been reported compromised
	return true
}

func (s *ZeroTrustService) calculateSessionAnomaly(ctx context.Context, tokenData *SessionTokenData) float64 {
	// Simple anomaly calculation based on session age
	age := time.Since(tokenData.CreatedAt)
	maxAge := s.config.MaxSessionDuration

	if age > maxAge/2 {
		return float64(age-maxAge/2) / float64(maxAge/2) * 0.5
	}

	return 0.0
}

func (s *ZeroTrustService) getCountryFromIP(ip string) string {
	// In production, use a GeoIP database
	if strings.HasPrefix(ip, "192.168.") || strings.HasPrefix(ip, "10.") || strings.HasPrefix(ip, "172.") {
		return "LOCAL"
	}
	return "US"
}

func (s *ZeroTrustService) generateDeviceFingerprint(request *TrustRequest) string {
	data := fmt.Sprintf("%s|%s|%s|%s",
		request.UserAgent,
		request.ClientIP,
		request.AcceptLanguage,
		request.TimeZone)

	hash := sha256.Sum256([]byte(data))
	return base64.StdEncoding.EncodeToString(hash[:])
}

func (s *ZeroTrustService) getDeviceTrust(ctx context.Context, fingerprint, userID string) (string, bool) {
	// In production, check against a device database
	return "", false
}

func (s *ZeroTrustService) registerDevice(ctx context.Context, fingerprint, userID string) string {
	deviceID := generateID()
	// In production, store in database
	return deviceID
}

func (s *ZeroTrustService) isRapidRequest(ctx context.Context, userID, clientIP string) bool {
	// In production, check against a rate limiter
	return false
}

func (s *ZeroTrustService) hasUnusualPattern(ctx context.Context, request *TrustRequest) bool {
	// In production, analyze request patterns
	return false
}

func (s *ZeroTrustService) hasSuspiciousUserAgent(userAgent string) bool {
	suspiciousPatterns := []string{
		"curl",
		"wget",
		"python-requests",
		"bot",
		"crawler",
		"scanner",
	}

	ua := strings.ToLower(userAgent)
	for _, pattern := range suspiciousPatterns {
		if strings.Contains(ua, pattern) {
			return true
		}
	}
	return false
}

func (s *ZeroTrustService) hasImpossibleTravel(ctx context.Context, request *TrustRequest) bool {
	// In production, check last known location and calculate travel speed
	return false
}

func (s *ZeroTrustService) storeSessionToken(ctx context.Context, tokenData *SessionTokenData) {
	// In production, store in a database or cache
}

// Supporting types and components

type CertificateManager struct {
	caCert *x509.Certificate
	caKey  *rsa.PrivateKey
}

func NewCertificateManager() *CertificateManager {
	return &CertificateManager{}
}

func (cm *CertificateManager) GenerateCertificate() (*Certificate, *rsa.PrivateKey, error) {
	// Generate private key
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, nil, err
	}

	// Create certificate template
	template := x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject: pkix.Name{
			Organization: []string{"SDLC.ai"},
			CommonName:   "client.sdlc.ai",
		},
		NotBefore:   time.Now(),
		NotAfter:    time.Now().Add(time.Hour * 24 * 365),
		KeyUsage:    x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth},
	}

	// Create certificate
	certDER, err := x509.CreateCertificate(rand.Reader, &template, &template, &priv.PublicKey, priv)
	if err != nil {
		return nil, nil, err
	}

	cert := &Certificate{
		ID:        generateID(),
		CertDER:   certDER,
		CreatedAt: time.Now(),
		ExpiresAt: template.NotAfter,
	}

	return cert, priv, nil
}

func (cm *CertificateManager) ValidateCertificate(certDER []byte, tlsSecret *tls.ConnectionState) *CertificateValidationResult {
	result := &CertificateValidationResult{
		Valid:  false,
		Reason: "",
	}

	if certDER == nil {
		result.Reason = "No certificate provided"
		return result
	}

	cert, err := x509.ParseCertificate(certDER)
	if err != nil {
		result.Reason = "Invalid certificate format"
		return result
	}

	// Check expiration
	if time.Now().After(cert.NotAfter) {
		result.Reason = "Certificate expired"
		return result
	}

	// Check if certificate is revoked
	if cm.isRevoked(cert) {
		result.Reason = "Certificate revoked"
		return result
	}

	result.Valid = true
	result.Subject = cert.Subject.CommonName
	result.ExpiresAt = cert.NotAfter

	return result
}

func (cm *CertificateManager) isRevoked(cert *x509.Certificate) bool {
	// In production, check against a CRL or OCSP
	return false
}

func (cm *CertificateManager) StoreCertificates(ctx context.Context, cert *Certificate, key *rsa.PrivateKey) error {
	// In production, store in a secure vault
	return nil
}

type RuntimePolicyValidator struct {
	client *Client
}

func NewRuntimePolicyValidator(client *Client) *RuntimePolicyValidator {
	return &RuntimePolicyValidator{client: client}
}

func (rp *RuntimePolicyValidator) ValidatePolicies(ctx context.Context, request *TrustRequest) (*PolicyValidationResult, error) {
	result := &PolicyValidationResult{
		Compliant:  true,
		Violations: []PolicyViolation{},
	}

	// In production, validate against actual policies
	return result, nil
}

type DataResidencyEnforcer struct {
	client *Client
}

func NewDataResidencyEnforcer(client *Client) *DataResidencyEnforcer {
	return &DataResidencyEnforcer{client: client}
}

func (dr *DataResidencyEnforcer) EnforceResidency(ctx context.Context, request *TrustRequest) *ResidencyEnforcementResult {
	result := &ResidencyEnforcementResult{
		Compliant: true,
		Region:    "US",
	}

	// In production, enforce based on data classification and user location
	return result
}

type RequestSigner struct {
	key *rsa.PrivateKey
}

func NewRequestSigner() *RequestSigner {
	// In production, load from secure storage
	key, _ := rsa.GenerateKey(rand.Reader, 2048)
	return &RequestSigner{key: key}
}

func (rs *RequestSigner) Sign(data []byte) ([]byte, error) {
	hash := sha256.Sum256(data)
	return rsa.SignPKCS1v15(rand.Reader, rs.key, crypto.SHA256, hash[:])
}

func (rs *RequestSigner) Verify(data []byte, signature []byte) bool {
	hash := sha256.Sum256(data)
	err := rsa.VerifyPKCS1v15(&rs.key.PublicKey, crypto.SHA256, hash[:], signature)
	return err == nil
}

type ZeroTrustAuditLogger struct {
	client *Client
}

func NewZeroTrustAuditLogger(client *Client) *ZeroTrustAuditLogger {
	return &ZeroTrustAuditLogger{client: client}
}

func (zal *ZeroTrustAuditLogger) LogViolation(ctx context.Context, requestID, violationType, reason string) {
	// In production, log to audit system
	fmt.Printf("[AUDIT] Violation: %s - %s: %s\n", requestID, violationType, reason)
}

func (zal *ZeroTrustAuditLogger) LogEnforcement(ctx context.Context, result *TrustResult) {
	// In production, log to audit system
	fmt.Printf("[AUDIT] Enforcement: %s - Trusted: %v, Risk: %s\n",
		result.RequestID, result.Trusted, result.RiskLevel)
}

func (zal *ZeroTrustAuditLogger) LogCertificateRotation(ctx context.Context, certID string) {
	fmt.Printf("[AUDIT] Certificate rotated: %s\n", certID)
}

// Type definitions

type TrustRequest struct {
	RequestID         string               `json:"request_id"`
	UserID            string               `json:"user_id"`
	SessionID         string               `json:"session_id"`
	Certificate       []byte               `json:"certificate,omitempty"`
	TLSSecret         *tls.ConnectionState `json:"tls_secret,omitempty"`
	Signature         []byte               `json:"signature,omitempty"`
	SignedData        []byte               `json:"signed_data,omitempty"`
	ClientIP          string               `json:"client_ip"`
	UserAgent         string               `json:"user_agent"`
	AcceptLanguage    string               `json:"accept_language"`
	TimeZone          string               `json:"time_zone"`
	DeviceFingerprint string               `json:"device_fingerprint"`
	RequestedResource string               `json:"requested_resource"`
	RequestMethod     string               `json:"request_method"`
	RequestHeaders    map[string]string    `json:"request_headers"`
	Timestamp         Timestamp            `json:"timestamp"`
}

type TrustResult struct {
	RequestID      string                 `json:"request_id"`
	Trusted        bool                   `json:"trusted"`
	RiskLevel      string                 `json:"risk_level"`
	Violations     []TrustViolation       `json:"violations"`
	Enforcements   []TrustEnforcement     `json:"enforcements"`
	Metadata       map[string]interface{} `json:"metadata"`
	ProcessingTime time.Duration          `json:"processing_time"`
	CreatedAt      Timestamp              `json:"created_at"`
}

type TrustViolation struct {
	Type        string `json:"type"`
	Description string `json:"description"`
	Severity    string `json:"severity"`
	PolicyID    string `json:"policy_id,omitempty"`
}

type TrustEnforcement struct {
	Type  string      `json:"type"`
	Value interface{} `json:"value"`
}

type SessionValidationResult struct {
	Valid    bool                   `json:"valid"`
	Reason   string                 `json:"reason"`
	Metadata map[string]interface{} `json:"metadata"`
}

type CertificateRotationResult struct {
	Rotated          bool      `json:"rotated"`
	Reason           string    `json:"reason,omitempty"`
	NewCertificateID string    `json:"new_certificate_id,omitempty"`
	RotationTime     Timestamp `json:"rotation_time"`
}

type GeoVerificationResult struct {
	Allowed bool   `json:"allowed"`
	Country string `json:"country"`
	Reason  string `json:"reason,omitempty"`
}

type DeviceVerificationResult struct {
	Trusted  bool   `json:"trusted"`
	DeviceID string `json:"device_id"`
	Reason   string `json:"reason,omitempty"`
}

type AnomalyDetectionResult struct {
	Score   float64                `json:"score"`
	Reason  string                 `json:"reason,omitempty"`
	Details map[string]interface{} `json:"details,omitempty"`
}

type SessionTokenData struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	DeviceID  string    `json:"device_id"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
}

type Certificate struct {
	ID        string    `json:"id"`
	CertDER   []byte    `json:"cert_der"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
}

type CertificateValidationResult struct {
	Valid     bool      `json:"valid"`
	Reason    string    `json:"reason,omitempty"`
	Subject   string    `json:"subject,omitempty"`
	ExpiresAt time.Time `json:"expires_at,omitempty"`
}

type PolicyValidationResult struct {
	Compliant  bool              `json:"compliant"`
	Violations []PolicyViolation `json:"violations"`
}

type PolicyViolation struct {
	Type        string `json:"type"`
	Description string `json:"description"`
	Severity    string `json:"severity"`
	PolicyID    string `json:"policy_id"`
}

type ResidencyEnforcementResult struct {
	Compliant bool   `json:"compliant"`
	Region    string `json:"region"`
	Reason    string `json:"reason,omitempty"`
}
