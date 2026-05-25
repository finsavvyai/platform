package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
)

// OAuthService handles OAuth authentication
type OAuthService struct {
	oauthRepo       repositories.OAuthRepository
	stateRepo       repositories.OAuthStateRepository
	userRepo        repositories.UserRepository
	config          OAuthConfig
	httpClient      *http.Client
}

// OAuthConfig contains OAuth configuration for all providers
type OAuthConfig struct {
	Google   ProviderConfig `json:"google"`
	GitHub   ProviderConfig `json:"github"`
	Microsoft ProviderConfig `json:"microsoft"`
	AzureAD  ProviderConfig `json:"azuread"`
}

// ProviderConfig contains configuration for a single OAuth provider
type ProviderConfig struct {
	ClientID     string   `json:"client_id"`
	ClientSecret string   `json:"client_secret"`
	RedirectURL  string   `json:"redirect_url"`
	Scopes       []string `json:"scopes"`
	Enabled      bool     `json:"enabled"`
}

// NewOAuthService creates a new OAuth service
func NewOAuthService(
	oauthRepo repositories.OAuthRepository,
	stateRepo repositories.OAuthStateRepository,
	userRepo repositories.UserRepository,
	config OAuthConfig,
) *OAuthService {
	return &OAuthService{
		oauthRepo: oauthRepo,
		stateRepo: stateRepo,
		userRepo:  userRepo,
		config:    config,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// GetAuthURL generates the OAuth authorization URL for a provider
func (s *OAuthService) GetAuthURL(ctx context.Context, provider entities.OAuthProvider, redirectURI string, userID *string) (string, error) {
	// Create OAuth state
	state := entities.NewOAuthState(provider, redirectURI, userID)
	if err := s.stateRepo.Create(ctx, state); err != nil {
		return "", fmt.Errorf("failed to create OAuth state: %w", err)
	}

	// Generate auth URL based on provider
	var authURL string
	switch provider {
	case entities.OAuthProviderGoogle:
		authURL = s.getGoogleAuthURL(state.State, redirectURI)
	case entities.OAuthProviderGitHub:
		authURL = s.getGitHubAuthURL(state.State, redirectURI)
	case entities.OAuthProviderMicrosoft, entities.OAuthProviderAzureAD:
		authURL = s.getMicrosoftAuthURL(state.State, redirectURI)
	default:
		return "", fmt.Errorf("unsupported OAuth provider: %s", provider)
	}

	return authURL, nil
}

// HandleCallback handles the OAuth callback
func (s *OAuthService) HandleCallback(ctx context.Context, provider entities.OAuthProvider, state, code string) (*entities.User, *entities.OAuthAccount, error) {
	// Validate state
	oauthState, err := s.stateRepo.GetByState(ctx, state)
	if err != nil {
		return nil, nil, fmt.Errorf("invalid OAuth state: %w", err)
	}

	if oauthState.IsExpired() {
		return nil, nil, fmt.Errorf("OAuth state expired")
	}

	if oauthState.Provider != provider {
		return nil, nil, fmt.Errorf("OAuth provider mismatch")
	}

	// Clean up state
	if err := s.stateRepo.Delete(ctx, state); err != nil {
		// Log error but continue
	}

	// Exchange code for tokens
	tokens, err := s.exchangeCodeForTokens(ctx, provider, code, oauthState.RedirectURI)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to exchange code for tokens: %w", err)
	}

	// Get user profile
	profile, err := s.getUserProfile(ctx, provider, tokens.AccessToken)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get user profile: %w", err)
	}

	// Check if OAuth account already exists
	existingAccount, err := s.oauthRepo.GetByProviderAndID(ctx, provider, profile.ProviderID)
	if err == nil && existingAccount != nil {
		// Account exists, update tokens and get user
		expiresAt := time.Now().Add(time.Duration(tokens.ExpiresIn) * time.Second)
		existingAccount.UpdateTokens(tokens.AccessToken, tokens.RefreshToken, &expiresAt)
		if err := s.oauthRepo.Update(ctx, existingAccount); err != nil {
			return nil, nil, fmt.Errorf("failed to update OAuth account: %w", err)
		}

		user, err := s.userRepo.GetByID(ctx, existingAccount.UserID)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to get user: %w", err)
		}

		return user, existingAccount, nil
	}

	// New OAuth account
	var user *entities.User

	// Check if linking to existing user
	if oauthState.UserID != nil {
		// Link to existing user
		user, err = s.userRepo.GetByID(ctx, *oauthState.UserID)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to get user for linking: %w", err)
		}
	} else {
		// Check if user exists with same email
		user, err = s.userRepo.GetByEmail(ctx, profile.Email)
		if err != nil {
			// Create new user
			user, err = s.createUserFromProfile(ctx, profile)
			if err != nil {
				return nil, nil, fmt.Errorf("failed to create user: %w", err)
			}
		}
	}

	// Create OAuth account
	expiresAt := time.Now().Add(time.Duration(tokens.ExpiresIn) * time.Second)
	oauthAccount := entities.NewOAuthAccount(
		user.ID,
		provider,
		profile.ProviderID,
		profile.Email,
		tokens.AccessToken,
		tokens.RefreshToken,
		s.getProviderScopes(provider),
	)
	oauthAccount.TokenExpiry = &expiresAt

	if err := s.oauthRepo.Create(ctx, oauthAccount); err != nil {
		return nil, nil, fmt.Errorf("failed to create OAuth account: %w", err)
	}

	return user, oauthAccount, nil
}

// UnlinkAccount removes an OAuth account link
func (s *OAuthService) UnlinkAccount(ctx context.Context, userID string, provider entities.OAuthProvider) error {
	account, err := s.oauthRepo.GetByUserAndProvider(ctx, userID, provider)
	if err != nil {
		return fmt.Errorf("OAuth account not found: %w", err)
	}

	return s.oauthRepo.Delete(ctx, account.ID)
}

// RefreshToken refreshes an expired OAuth token
func (s *OAuthService) RefreshToken(ctx context.Context, accountID string) error {
	account, err := s.oauthRepo.GetByID(ctx, accountID)
	if err != nil {
		return fmt.Errorf("OAuth account not found: %w", err)
	}

	tokens, err := s.refreshProviderToken(ctx, account.Provider, account.RefreshToken)
	if err != nil {
		return fmt.Errorf("failed to refresh token: %w", err)
	}

	expiresAt := time.Now().Add(time.Duration(tokens.ExpiresIn) * time.Second)
	account.UpdateTokens(tokens.AccessToken, tokens.RefreshToken, &expiresAt)

	return s.oauthRepo.Update(ctx, account)
}

// Provider-specific implementations

func (s *OAuthService) getGoogleAuthURL(state, redirectURI string) string {
	config := s.config.Google
	params := url.Values{}
	params.Add("client_id", config.ClientID)
	params.Add("redirect_uri", redirectURI)
	params.Add("response_type", "code")
	params.Add("scope", "openid profile email")
	params.Add("state", state)
	params.Add("access_type", "offline")
	params.Add("prompt", "consent")

	return "https://accounts.google.com/o/oauth2/v2/auth?" + params.Encode()
}

func (s *OAuthService) getGitHubAuthURL(state, redirectURI string) string {
	config := s.config.GitHub
	params := url.Values{}
	params.Add("client_id", config.ClientID)
	params.Add("redirect_uri", redirectURI)
	params.Add("response_type", "code")
	params.Add("scope", "user:email read:user")
	params.Add("state", state)

	return "https://github.com/login/oauth/authorize?" + params.Encode()
}

func (s *OAuthService) getMicrosoftAuthURL(state, redirectURI string) string {
	config := s.config.Microsoft
	params := url.Values{}
	params.Add("client_id", config.ClientID)
	params.Add("redirect_uri", redirectURI)
	params.Add("response_type", "code")
	params.Add("scope", "openid profile email")
	params.Add("state", state)
	params.Add("response_mode", "query")

	return "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?" + params.Encode()
}

func (s *OAuthService) exchangeCodeForTokens(ctx context.Context, provider entities.OAuthProvider, code, redirectURI string) (*entities.OAuthTokenResponse, error) {
	var tokenURL string
	var config ProviderConfig

	switch provider {
	case entities.OAuthProviderGoogle:
		tokenURL = "https://oauth2.googleapis.com/token"
		config = s.config.Google
	case entities.OAuthProviderGitHub:
		tokenURL = "https://github.com/login/oauth/access_token"
		config = s.config.GitHub
	case entities.OAuthProviderMicrosoft, entities.OAuthProviderAzureAD:
		tokenURL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
		config = s.config.Microsoft
	default:
		return nil, fmt.Errorf("unsupported provider: %s", provider)
	}

	data := url.Values{}
	data.Set("code", code)
	data.Set("grant_type", "authorization_code")
	data.Set("redirect_uri", redirectURI)
	data.Set("client_id", config.ClientID)
	data.Set("client_secret", config.ClientSecret)

	req, err := http.NewRequestWithContext(ctx, "POST", tokenURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	// For GitHub, we need to set basic auth
	if provider == entities.OAuthProviderGitHub {
		req.SetBasicAuth(config.ClientID, config.ClientSecret)
	}

	req.Body = io.NopCloser(nil)

	// Create form data reader
	formData := data.Encode()
	req.Body = io.NopCloser(&formDataReader{data: formData})
	req.ContentLength = int64(len(formData))

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("token exchange failed: %s", string(body))
	}

	var tokens entities.OAuthTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokens); err != nil {
		return nil, err
	}

	return &tokens, nil
}

func (s *OAuthService) getUserProfile(ctx context.Context, provider entities.OAuthProvider, accessToken string) (*entities.OAuthUserProfile, error) {
	var userInfoURL string

	switch provider {
	case entities.OAuthProviderGoogle:
		userInfoURL = "https://www.googleapis.com/oauth2/v2/userinfo"
	case entities.OAuthProviderGitHub:
		userInfoURL = "https://api.github.com/user"
	case entities.OAuthProviderMicrosoft, entities.OAuthProviderAzureAD:
		userInfoURL = "https://graph.microsoft.com/v1.0/me"
	default:
		return nil, fmt.Errorf("unsupported provider: %s", provider)
	}

	req, err := http.NewRequestWithContext(ctx, "GET", userInfoURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get user profile: %s", string(body))
	}

	profile := &entities.OAuthUserProfile{Provider: provider}

	switch provider {
	case entities.OAuthProviderGoogle:
		var googleProfile struct {
			ID            string `json:"id"`
			Email         string `json:"email"`
			VerifiedEmail bool   `json:"verified_email"`
			Name          string `json:"name"`
			GivenName     string `json:"given_name"`
			FamilyName    string `json:"family_name"`
			Picture       string `json:"picture"`
			Locale        string `json:"locale"`
			HD            string `json:"hd"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&googleProfile); err != nil {
			return nil, err
		}
		profile.ProviderID = googleProfile.ID
		profile.Email = googleProfile.Email
		profile.EmailVerified = googleProfile.VerifiedEmail
		profile.Name = googleProfile.Name
		profile.FirstName = googleProfile.GivenName
		profile.LastName = googleProfile.FamilyName
		profile.Picture = googleProfile.Picture
		profile.Locale = googleProfile.Locale
		profile.HD = googleProfile.HD

	case entities.OAuthProviderGitHub:
		var githubProfile struct {
			ID        int64  `json:"id"`
			Login     string `json:"login"`
			Email     string `json:"email"`
			Name      string `json:"name"`
			AvatarURL string `json:"avatar_url"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&githubProfile); err != nil {
			return nil, err
		}
		profile.ProviderID = fmt.Sprintf("%d", githubProfile.ID)
		if githubProfile.Email == "" {
			// GitHub requires separate API call for email
			profile.Email, _ = s.getGitHubEmail(ctx, accessToken)
		} else {
			profile.Email = githubProfile.Email
		}
		profile.EmailVerified = true // GitHub emails are verified
		profile.Name = githubProfile.Name
		if profile.Name == "" {
			profile.Name = githubProfile.Login
		}
		profile.Picture = githubProfile.AvatarURL

	case entities.OAuthProviderMicrosoft, entities.OAuthProviderAzureAD:
		var microsoftProfile struct {
			ID                string `json:"id"`
			DisplayName       string `json:"displayName"`
			GivenName         string `json:"givenName"`
			Surname           string `json:"surname"`
			Mail              string `json:"mail"`
			UserPrincipalName string `json:"userPrincipalName"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&microsoftProfile); err != nil {
			return nil, err
		}
		profile.ProviderID = microsoftProfile.ID
		profile.Name = microsoftProfile.DisplayName
		profile.FirstName = microsoftProfile.GivenName
		profile.LastName = microsoftProfile.Surname
		if microsoftProfile.Mail != "" {
			profile.Email = microsoftProfile.Mail
		} else {
			profile.Email = microsoftProfile.UserPrincipalName
		}
		profile.EmailVerified = true
	}

	return profile, nil
}

func (s *OAuthService) getGitHubEmail(ctx context.Context, accessToken string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/user/emails", nil)
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var emails []struct {
		Email   string `json:"email"`
		Primary bool   `json:"primary"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&emails); err != nil {
		return "", err
	}

	for _, email := range emails {
		if email.Primary {
			return email.Email, nil
		}
	}

	if len(emails) > 0 {
		return emails[0].Email, nil
	}

	return "", fmt.Errorf("no email found")
}

func (s *OAuthService) refreshProviderToken(ctx context.Context, provider entities.OAuthProvider, refreshToken string) (*entities.OAuthTokenResponse, error) {
	// Implementation for refreshing tokens
	// Similar to exchangeCodeForTokens but with refresh_token grant
	return nil, fmt.Errorf("token refresh not implemented for %s", provider)
}

func (s *OAuthService) createUserFromProfile(ctx context.Context, profile *entities.OAuthUserProfile) (*entities.User, error) {
	// This would use the auth service to create a user
	// For now, return an error as it should be integrated with AuthService
	return nil, fmt.Errorf("user creation should be done through AuthService")
}

func (s *OAuthService) getProviderScopes(provider entities.OAuthProvider) []string {
	switch provider {
	case entities.OAuthProviderGoogle:
		return []string{"openid", "profile", "email"}
	case entities.OAuthProviderGitHub:
		return []string{"user:email", "read:user"}
	case entities.OAuthProviderMicrosoft, entities.OAuthProviderAzureAD:
		return []string{"openid", "profile", "email"}
	default:
		return []string{}
	}
}

// formDataReader helps with form data encoding
type formDataReader struct {
	data string
	pos  int
}

func (r *formDataReader) Read(p []byte) (n int, err error) {
	if r.pos >= len(r.data) {
		return 0, io.EOF
	}
	n = copy(p, r.data[r.pos:])
	r.pos += n
	return n, nil
}
