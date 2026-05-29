package auth

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/SDLC/sdln-sdk-go/pkg/sdln"
	"github.com/go-webauthn/webauthn"
	"github.com/go-webauthn/webauthn/protocol"
)

// BiometricAuth implements WebAuthn/FIDO2 biometric authentication
type BiometricAuth struct {
	webAuthn       *webauthn.WebAuthn
	sessionStore   BiometricSessionStore
	userStore      BiometricUserStore
	challengeStore BiometricChallengeStore
	clock          Clock
	config         *BiometricConfig
}

// BiometricConfig holds biometric authentication configuration
type BiometricConfig struct {
	RPDisplayName         string        `json:"rp_display_name"`          // Relying Party display name
	RPID                  string        `json:"rp_id"`                    // Relying Party ID
	RPOrigins             []string      `json:"rp_origins"`               // Allowed origins
	AttestationTimeout    time.Duration `json:"attestation_timeout"`      // Attestation timeout
	AssertionTimeout      time.Duration `json:"assertion_timeout"`        // Assertion timeout
	UserVerification      string        `json:"user_verification"`        // User verification requirement
	RequireResidentKey    bool          `json:"require_resident_key"`     // Require resident keys
	Timeout               time.Duration `json:"timeout"`                  // Operation timeout
	ChallengeExpiry       time.Duration `json:"challenge_expiry"`         // Challenge expiry time
	MaxCredentialsPerUser int           `json:"max_credentials_per_user"` // Max credentials per user
	SupportedAlgorithms   []string      `json:"supported_algorithms"`     // Supported algorithms
	Debug                 bool          `json:"debug"`                    // Debug mode
}

// BiometricSessionStore interface for storing biometric sessions
type BiometricSessionStore interface {
	Store(ctx context.Context, sessionID string, session *BiometricSession) error
	Get(ctx context.Context, sessionID string) (*BiometricSession, error)
	Delete(ctx context.Context, sessionID string) error
	Update(ctx context.Context, sessionID string, session *BiometricSession) error
}

// BiometricUserStore interface for storing biometric users
type BiometricUserStore interface {
	FindByID(ctx context.Context, id string) (*BiometricUser, error)
	FindByHandle(ctx context.Context, handle string) (*BiometricUser, error)
	FindByEmail(ctx context.Context, email string) (*BiometricUser, error)
	Store(ctx context.Context, user *BiometricUser) error
	Update(ctx context.Context, user *BiometricUser) error
	Delete(ctx context.Context, id string) error
	List(ctx context.Context, filters map[string]interface{}) ([]*BiometricUser, error)
}

// BiometricChallengeStore interface for storing challenges
type BiometricChallengeStore interface {
	Store(ctx context.Context, challengeID string, challenge *BiometricChallenge) error
	Get(ctx context.Context, challengeID string) (*BiometricChallenge, error)
	Delete(ctx context.Context, challengeID string) error
	CleanupExpired(ctx context.Context) error
}

// BiometricSession represents a biometric authentication session
type BiometricSession struct {
	SessionID   string                 `json:"session_id"`
	UserID      string                 `json:"user_id"`
	CreatedAt   time.Time              `json:"created_at"`
	ExpiresAt   time.Time              `json:"expires_at"`
	ChallengeID string                 `json:"challenge_id"`
	UserAgent   string                 `json:"user_agent"`
	IPAddress   string                 `json:"ip_address"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// BiometricUser represents a user with biometric credentials
type BiometricUser struct {
	ID          string                `json:"id"`
	Name        string                `json:"name"`
	Email       string                `json:"email"`
	DisplayName string                `json:"display_name"`
	Icon        string                `json:"icon"`
	Credentials []BiometricCredential `json:"credentials"`
	Preferences *BiometricPreferences `json:"preferences"`
	CreatedAt   time.Time             `json:"created_at"`
	UpdatedAt   time.Time             `json:"updated_at"`
	LastLogin   time.Time             `json:"last_login"`
	Active      bool                  `json:"active"`
}

// BiometricCredential represents a WebAuthn credential
type BiometricCredential struct {
	ID              string                            `json:"id"`
	PublicKey       []byte                            `json:"public_key"`
	AttestationType string                            `json:"attestation_type"`
	AAGUID          []byte                            `json:"aaguid"`
	SignCount       uint32                            `json:"sign_count"`
	CloneWarning    bool                              `json:"clone_warning"`
	Transport       []protocol.AuthenticatorTransport `json:"transport"`
	CreatedAt       time.Time                         `json:"created_at"`
	LastUsed        time.Time                         `json:"last_used"`
	UserAgent       string                            `json:"user_agent"`
	DeviceType      string                            `json:"device_type"`
	Authenticator   protocol.Authenticator            `json:"authenticator"`
	Metadata        map[string]interface{}            `json:"metadata"`
}

// BiometricPreferences represents user preferences
type BiometricPreferences struct {
	RequireUserVerification bool `json:"require_user_verification"`
	AutoSelect              bool `json:"auto_select"`
	ShowHints               bool `json:"show_hints"`
}

// BiometricChallenge represents a WebAuthn challenge
type BiometricChallenge struct {
	ID        string    `json:"id"`
	Challenge []byte    `json:"challenge"`
	ExpiresAt time.Time `json:"expires_at"`
	UserID    string    `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}

// RegistrationOptions represents options for credential registration
type RegistrationOptions struct {
	UserName              string                         `json:"user_name"`
	UserID                string                         `json:"user_id"`
	UserDisplayName       string                         `json:"user_display_name"`
	UserIcon              string                         `json:"user_icon"`
	RequireResidentKey    bool                           `json:"require_resident_key"`
	UserVerification      string                         `json:"user_verification"`
	ExcludeCredentials    []string                       `json:"exclude_credentials"`
	Timeout               time.Duration                  `json:"timeout"`
	AttestationPreference string                         `json:"attestation_preference"`
	Extensions            []protocol.CredentialExtension `json:"extensions"`
}

// AuthenticationOptions represents options for credential authentication
type AuthenticationOptions struct {
	UserID             string                         `json:"user_id"`
	Timeout            time.Duration                  `json:"timeout"`
	UserVerification   string                         `json:"user_verification"`
	Extensions         []protocol.CredentialExtension `json:"extensions"`
	AllowedCredentials []string                       `json:"allowed_credentials"`
	UserVerification   string                         `json:"user_verification"`
}

// NewBiometricAuth creates a new biometric authenticator
func NewBiometricAuth(config *BiometricConfig, sessionStore BiometricSessionStore, userStore BiometricUserStore, challengeStore BiometricChallengeStore) (*BiometricAuth, error) {
	if config == nil {
		return nil, fmt.Errorf("biometric config is required")
	}
	if sessionStore == nil {
		return nil, fmt.Errorf("session store is required")
	}
	if userStore == nil {
		return nil, fmt.Errorf("user store is required")
	}
	if challengeStore == nil {
		return nil, fmt.Errorf("challenge store is required")
	}

	// Set default values
	if config.RPDisplayName == "" {
		config.RPDisplayName = "SDLC Platform"
	}
	if config.RPID == "" {
		config.RPID = "localhost"
	}
	if len(config.RPOrigins) == 0 {
		config.RPOrigins = []string{"http://localhost:3000", "https://localhost:3000"}
	}
	if config.AttestationTimeout == 0 {
		config.AttestationTimeout = 60 * time.Second
	}
	if config.AssertionTimeout == 0 {
		config.AssertionTimeout = 60 * time.Second
	}
	if config.UserVerification == "" {
		config.UserVerification = "preferred"
	}
	if config.Timeout == 0 {
		config.Timeout = 300 * time.Second
	}
	if config.ChallengeExpiry == 0 {
		config.ChallengeExpiry = 5 * time.Minute
	}
	if config.MaxCredentialsPerUser == 0 {
		config.MaxCredentialsPerUser = 10
	}
	if len(config.SupportedAlgorithms) == 0 {
		config.SupportedAlgorithms = []string{
			"ES256",
			"ES384",
			"RS256",
			"RS384",
			"RS1",
		}
	}

	// Create WebAuthn instance
	webAuthnConfig := &webauthn.Config{
		RPDisplayName:         config.RPDisplayName,
		RPID:                  config.RPID,
		RPOrigins:             config.RPOrigins,
		AttestationPreference: protocol.PreferNoAttestation,
	}

	webAuthn, err := webauthn.New(webAuthnConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create WebAuthn instance: %w", err)
	}

	auth := &BiometricAuth{
		webAuthn:       webAuthn,
		sessionStore:   sessionStore,
		userStore:      userStore,
		challengeStore: challengeStore,
		clock:          SystemClock{},
		config:         config,
	}

	// Start cleanup goroutine
	go auth.cleanupExpiredChallenges()

	return auth, nil
}

// StartRegistration begins biometric credential registration
func (b *BiometricAuth) StartRegistration(ctx context.Context, options *RegistrationOptions) (*protocol.CredentialCreation, *BiometricSession, error) {
	// Create session
	sessionID := sdln.GenerateID()
	session := &BiometricSession{
		SessionID: sessionID,
		UserID:    options.UserID,
		CreatedAt: b.clock.Now(),
		ExpiresAt: b.clock.Now().Add(b.config.Timeout),
		Metadata:  make(map[string]interface{}),
	}

	// Store session
	if err := b.sessionStore.Store(ctx, sessionID, session); err != nil {
		return nil, nil, fmt.Errorf("failed to store session: %w", err)
	}

	// Create WebAuthn user
	webauthnUser, err := b.createWebAuthnUser(options)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create WebAuthn user: %w", err)
	}

	// Generate challenge
	challenge, err := b.webAuthn.BeginDiscoverableLogin(webauthnUser)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to begin discovery: %w", err)
	}

	// Store challenge
	challengeData := &BiometricChallenge{
		ID:        challenge.ChallengeID,
		Challenge: challenge.Challenge,
		ExpiresAt: b.clock.Now().Add(b.config.ChallengeExpiry),
		UserID:    options.UserID,
		CreatedAt: b.clock.Now(),
	}

	if err := b.challengeStore.Store(ctx, challenge.ID, challengeData); err != nil {
		return nil, nil, fmt.Errorf("failed to store challenge: %w", err)
	}

	// Update session with challenge ID
	session.ChallengeID = challenge.ID
	if err := b.sessionStore.Update(ctx, sessionID, session); err != nil {
		return nil, nil, fmt.Errorf("failed to update session: %w", err)
	}

	return challenge.Creation, session, nil
}

// FinishRegistration completes biometric credential registration
func (b *BiometricAuth) FinishRegistration(ctx context.Context, sessionID string, response *protocol.ParsedCredentialCreationData) (*BiometricUser, *BiometricCredential, error) {
	// Retrieve session
	session, err := b.sessionStore.Get(ctx, sessionID)
	if err != nil {
		return nil, nil, fmt.Errorf("session not found: %w", err)
	}

	// Check session expiration
	if b.clock.Now().After(session.ExpiresAt) {
		return nil, nil, fmt.Errorf("session expired")
	}

	// Retrieve challenge
	challenge, err := b.challengeStore.Get(ctx, session.ChallengeID)
	if err != nil {
		return nil, nil, fmt.Errorf("challenge not found: %w", err)
	}

	// Verify challenge
	if !bytes.Equal(challenge.Challenge, response.Response.CollectedClientData.Challenge) {
		return nil, nil, fmt.Errorf("challenge mismatch")
	}

	// Complete registration
	credential, err := b.webAuthn.FinishDiscoverableLogin(challenge, response)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to finish discovery: %w", err)
	}

	// Get existing user
	user, err := b.userStore.FindByID(ctx, session.UserID)
	if err != nil {
		return nil, nil, fmt.Errorf("user not found: %w", err)
	}

	// Create biometric credential
	biometricCred := &BiometricCredential{
		ID:              credential.ID,
		PublicKey:       credential.PublicKey,
		AttestationType: string(credential.AttestationType),
		AAGUID:          credential.AAGUID,
		SignCount:       credential.SignCount,
		CloneWarning:    credential.Flags.CloneWarning,
		Transport:       credential.Transport,
		CreatedAt:       b.clock.Now(),
		LastUsed:        b.clock.Now(),
		Authenticator:   credential.Authenticator,
		Metadata:        make(map[string]interface{}),
	}

	// Get transport information
	if len(credential.Transport) > 0 {
		biometricCred.Transport = credential.Transport
		biometricCred.DeviceType = b.detectDeviceType(credential.Transport)
	}

	// Add credential to user
	user.Credentials = append(user.Credentials, *biometricCred)

	// Update user
	if err := b.userStore.Update(ctx, user); err != nil {
		return nil, nil, fmt.Errorf("failed to update user: %w", err)
	}

	// Clean up
	b.challengeStore.Delete(ctx, challenge.ID)
	b.sessionStore.Delete(ctx, sessionID)

	return user, biometricCred, nil
}

// BeginAuthentication begins biometric authentication
func (b *BiometricAuth) BeginAuthentication(ctx context.Context, options *AuthenticationOptions) (*protocol.CredentialAssertion, *BiometricSession, error) {
	// Get user
	user, err := b.userStore.FindByID(ctx, options.UserID)
	if err != nil {
		return nil, nil, fmt.Errorf("user not found: %w", err)
	}

	// Check if user has credentials
	if len(user.Credentials) == 0 {
		return nil, nil, fmt.Errorf("user has no biometric credentials")
	}

	// Create session
	sessionID := sdln.GenerateID()
	session := &BiometricSession{
		SessionID: sessionID,
		UserID:    options.UserID,
		CreatedAt: b.clock.Now(),
		ExpiresAt: b.clock.Now().Add(b.config.Timeout),
		Metadata:  make(map[string]interface{}),
	}

	// Store session
	if err := b.sessionStore.Store(ctx, sessionID, session); err != nil {
		return nil, nil, fmt.Errorf("failed to store session: %w", err)
	}

	// Create WebAuthn user
	webauthnUser := b.createWebAuthnUserForExisting(user)

	// Filter credentials if specified
	if len(options.AllowedCredentials) > 0 {
		webauthnUser.Credentials = b.filterCredentials(user.Credentials, options.AllowedCredentials)
	}

	// Begin assertion
	assertion, err := b.webAuthn.BeginLogin(webauthnUser, b.createLoginOptions(options))
	if err != nil {
		return nil, nil, fmt.Errorf("failed to begin login: %w", err)
	}

	// Store challenge
	challengeData := &BiometricChallenge{
		ID:        assertion.ChallengeID,
		Challenge: assertion.Challenge,
		ExpiresAt: b.clock.Now().Add(b.config.ChallengeExpiry),
		UserID:    options.UserID,
		CreatedAt: b.clock.Now(),
	}

	if err := b.challengeStore.Store(ctx, assertion.ChallengeID, challengeData); err != nil {
		return nil, nil, fmt.Errorf("failed to store challenge: %w", err)
	}

	// Update session with challenge ID
	session.ChallengeID = assertion.ChallengeID
	if err := b.sessionStore.Update(ctx, sessionID, session); err != nil {
		return nil, nil, fmt.Errorf("failed to update session: %w", err)
	}

	return assertion.Assertion, session, nil
}

// FinishAuthentication completes biometric authentication
func (b *BiometricAuth) FinishAuthentication(ctx context.Context, sessionID string, response *protocol.ParsedCredentialAssertionData) (*BiometricSession, error) {
	// Retrieve session
	session, err := b.sessionStore.Get(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("session not found: %w", err)
	}

	// Check session expiration
	if b.clock.Now().After(session.ExpiresAt) {
		return nil, fmt.Errorf("session expired")
	}

	// Retrieve challenge
	challenge, err := b.challengeStore.Get(ctx, session.ChallengeID)
	if err != nil {
		return nil, fmt.Errorf("challenge not found: %w", err)
	}

	// Verify challenge
	if !bytes.Equal(challenge.Challenge, response.Response.CollectedClientData.Challenge) {
		return nil, fmt.Errorf("challenge mismatch")
	}

	// Create WebAuthn user
	user, err := b.userStore.FindByID(ctx, session.UserID)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	webauthnUser := b.createWebAuthnUserForExisting(user)

	// Complete authentication
	credential, err := b.webAuthn.FinishLogin(webauthnUser, challenge, response)
	if err != nil {
		return nil, fmt.Errorf("failed to finish login: %w", err)
	}

	// Find the credential in user's credentials
	var cred *BiometricCredential
	for i := range user.Credentials {
		if user.Credentials[i].ID == credential.ID {
			cred = &user.Credentials[i]
			break
		}
	}

	if cred == nil {
		return nil, fmt.Errorf("credential not found")
	}

	// Update credential
	cred.SignCount = credential.Authenticator.SignCount
	cred.LastUsed = b.clock.Now()

	// Clone warning check
	if credential.Flags.CloneWarning {
		cred.CloneWarning = true
	}

	// Update user
	for i := range user.Credentials {
		if user.Credentials[i].ID == credential.ID {
			user.Credentials[i] = *cred
			break
		}
	}

	user.LastLogin = b.clock.Now()
	if err := b.userStore.Update(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	// Update session
	session.LastAccessed = b.clock.Now()
	session.ExpiresAt = b.clock.Now().Add(24 * time.Hour) // Extend session
	if err := b.sessionStore.Update(ctx, sessionID, session); err != nil {
		return nil, fmt.Errorf("failed to update session: %w", err)
	}

	// Clean up
	b.challengeStore.Delete(ctx, challenge.ID)

	return session, nil
}

// GetCredentials retrieves user's biometric credentials
func (b *BiometricAuth) GetCredentials(ctx context.Context, userID string) ([]BiometricCredential, error) {
	user, err := b.userStore.FindByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	return user.Credentials, nil
}

// DeleteCredential deletes a biometric credential
func (b *BiometricAuth) DeleteCredential(ctx context.Context, userID, credentialID string) error {
	user, err := b.userStore.FindByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	// Find and remove credential
	for i, cred := range user.Credentials {
		if cred.ID == credentialID {
			user.Credentials = append(user.Credentials[:i], user.Credentials[i+1:]...)
			break
		}
	}

	// Update user
	if err := b.userStore.Update(ctx, user); err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	return nil
}

// createWebAuthnUser creates a WebAuthn user for registration
func (b *BiometricAuth) createWebAuthnUser(options *RegistrationOptions) (webauthn.User, error) {
	return webauthn.User{
		ID:          options.UserID,
		DisplayName: options.UserDisplayName,
		Name:        options.UserName,
		Icon:        options.UserIcon,
		Credentials: []webauthn.Credential{},
	}, nil
}

// createWebAuthnUserForExisting creates a WebAuthn user for an existing user
func (b *BiometricAuth) createWebAuthnUserForExisting(user *BiometricUser) webauthn.User {
	credentials := make([]webauthn.Credential, len(user.Credentials))
	for _, cred := range user.Credentials {
		webauthnCred := webauthn.Credential{
			ID:          cred.ID,
			PublicKey:   cred.PublicKey,
			Attestation: protocol.AttestationType(cred.AttestationType),
			Authenticator: webauthn.Authenticator{
				AAGUID:     cred.AAGUID,
				Attachment: protocol.AuthenticatorAttachment(cred.Authenticator.Attachment),
				Transport:  cred.Transport,
			},
			SignCount: cred.SignCount,
		}
		credentials = append(credentials, webauthnCred)
	}

	return webauthn.User{
		ID:          user.ID,
		DisplayName: user.DisplayName,
		Name:        user.Name,
		Icon:        user.Icon,
		Credentials: credentials,
	}
}

// createLoginOptions creates login options
func (b *BiometricAuth) createLoginOptions(options *AuthenticationOptions) webauthn.LoginOpts {
	opts := webauthn.LoginOpts{
		Timeout: options.Timeout,
	}

	switch options.UserVerification {
	case "required":
		opts.UserVerification = webauthn.VerificationRequired
	case "preferred":
		opts.UserVerification = webauthn.VerificationPreferred
	case "discouraged":
		opts.UserVerification = webauthn.VerificationDiscouraged
	default:
		opts.UserVerification = webauthn.VerificationPreferred
	}

	return opts
}

// filterCredentials filters credentials by allowed IDs
func (b *BiometricAuth) filterCredentials(credentials []BiometricCredential, allowedIDs []string) []webauthn.Credential {
	allowedSet := make(map[string]bool)
	for _, id := range allowedIDs {
		allowedSet[id] = true
	}

	var filtered []webauthn.Credential
	for _, cred := range credentials {
		if allowedSet[cred.ID] {
			webauthnCred := webauthn.Credential{
				ID:          cred.ID,
				PublicKey:   cred.PublicKey,
				Attestation: protocol.AttestationType(cred.AttestationType),
				Authenticator: webauthn.Authenticator{
					AAGUID:     cred.AAGUID,
					Attachment: protocol.AuthenticatorAttachment(cred.Authenticator.Attachment),
					Transport:  cred.Transport,
				},
				SignCount: cred.SignCount,
			}
			filtered = append(filtered, webauthnCred)
		}
	}

	return filtered
}

// detectDeviceType detects device type from transport information
func (b *BiometricAuth) detectDeviceType(transports []protocol.AuthenticatorTransport) string {
	for _, transport := range transports {
		switch transport {
		case protocol.Internal:
			return "internal"
		case protocol.USB:
			return "usb"
		case protocol.NFC:
			return "nfc"
		case protocol.BLE:
			return "ble"
		case protocol.Hybrid:
			return "hybrid"
		}
	}
	return "unknown"
}

// cleanupExpiredChallenges cleans up expired challenges
func (b *BiometricAuth) cleanupExpiredChallenges() {
	ticker := time.NewTicker(b.config.ChallengeExpiry / 2)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			ctx := context.Background()
			b.challengeStore.CleanupExpired(ctx)
		}
	}
}

// Authenticate implements the Authenticator interface
func (b *BiometricAuth) Authenticate(ctx context.Context, req sdln.Request) error {
	// Biometric authentication is handled at the application layer
	// This method can add any biometric-specific headers if needed
	return nil
}

// RefreshToken is a no-op for biometric authentication
func (b *BiometricAuth) RefreshToken(ctx context.Context) error {
	return nil
}

// IsValid checks if the biometric session is valid
func (b *BiometricAuth) IsValid(ctx context.Context) bool {
	// Biometric validation is handled by session management
	return true
}

// Cleanup cleans up expired sessions and challenges
func (b *BiometricAuth) Cleanup(ctx context.Context) error {
	return b.challengeStore.CleanupExpired(ctx)
}

// GetSession retrieves a biometric session
func (b *BiometricAuth) GetSession(ctx context.Context, sessionID string) (*BiometricSession, error) {
	return b.sessionStore.Get(ctx, sessionID)
}

// DeleteSession deletes a biometric session
func (b *BiometricAuth) DeleteSession(ctx context.Context, sessionID string) error {
	return b.sessionStore.Delete(ctx, sessionID)
}

// RefreshSession refreshes a biometric session
func (b *BiometricAuth) RefreshSession(ctx context.Context, sessionID string) error {
	session, err := b.sessionStore.Get(ctx, sessionID)
	if err != nil {
		return err
	}

	// Update last accessed time
	session.LastAccessed = b.clock.Now()
	session.ExpiresAt = b.clock.Now().Add(24 * time.Hour)

	return b.sessionStore.Update(ctx, sessionID, session)
}

// CreateUser creates a new user for biometric authentication
func (b *BiometricAuth) CreateUser(ctx context.Context, options *RegistrationOptions) (*BiometricUser, error) {
	user := &BiometricUser{
		ID:          options.UserID,
		Name:        options.UserName,
		Email:       strings.ToLower(options.UserName), // Use email as identifier
		DisplayName: options.UserDisplayName,
		Icon:        options.UserIcon,
		Credentials: []BiometricCredential{},
		Preferences: &BiometricPreferences{
			RequireUserVerification: b.config.UserVerification == "required",
			AutoSelect:              true,
			ShowHints:               true,
		},
		CreatedAt: b.clock.Now(),
		UpdatedAt: b.clock.Now(),
		Active:    true,
	}

	if err := b.userStore.Store(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return user, nil
}

// GetUser retrieves a user by ID
func (b *BiometricAuth) GetUser(ctx context.Context, userID string) (*BiometricUser, error) {
	return b.userStore.FindByID(ctx, userID)
}

// GetUserByHandle retrieves a user by credential handle
func (b *BiometricAuth) GetUserByHandle(ctx context.Context, handle string) (*BiometricUser, error) {
	return b.userStore.FindByHandle(ctx, handle)
}

// GetUserByEmail retrieves a user by email
func (b *BiometricAuth) GetUserByEmail(ctx context.Context, email string) (*BiometricUser, error) {
	return b.userStore.FindByEmail(ctx, strings.ToLower(email))
}

// UpdateUser updates a user
func (b *BiometricAuth) UpdateUser(ctx context.Context, user *BiometricUser) error {
	user.UpdatedAt = b.clock.Now()
	return b.userStore.Update(ctx, user)
}

// DeactivateUser deactivates a user
func (b *BiometricAuth) DeactivateUser(ctx context.Context, userID string) error {
	user, err := b.userStore.FindByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	user.Active = false
	user.UpdatedAt = b.clock.Now()

	return b.userStore.Update(ctx, user)
}

// TestConnection tests the biometric authentication system
func (b *BiometricAuth) TestConnection(ctx context.Context) error {
	// Test by creating a simple challenge
	challengeID := sdln.GenerateID()
	challengeData := &BiometricChallenge{
		ID:        challengeID,
		Challenge: []byte("test-challenge-" + challengeID),
		ExpiresAt: b.clock.Now().Add(b.config.ChallengeExpiry),
		UserID:    "test-user",
		CreatedAt: b.clock.Now(),
	}

	return b.challengeStore.Store(ctx, challengeID, challengeData)
}
