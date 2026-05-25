package analysis

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

func (v *SecretValidator) validateAWSKey(ctx context.Context, key string) *ValidateResult {
	// Calling STS GetCallerIdentity without auth returns a 403 with a structured
	// error. A valid-format key that doesn't exist returns InvalidClientTokenId;
	// an active key returns caller identity.
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		"https://sts.amazonaws.com/?Action=GetCallerIdentity&Version=2011-06-15", nil)
	if err != nil {
		return &ValidateResult{Status: ValidityUnknown, Error: err.Error()}
	}
	req.Header.Set("Authorization", "AWS4-HMAC-SHA256 Credential="+key)

	resp, err := v.httpClient.Do(req)
	if err != nil {
		return &ValidateResult{Status: ValidityUnknown, Error: err.Error()}
	}
	defer func() { _ = resp.Body.Close() }()

	body, _ := io.ReadAll(resp.Body)
	bodyStr := string(body)

	if resp.StatusCode == http.StatusOK {
		return &ValidateResult{Valid: true, Status: ValidityActive}
	}
	if strings.Contains(bodyStr, "InvalidClientTokenId") {
		return &ValidateResult{Status: ValidityInvalid}
	}
	if resp.StatusCode == http.StatusForbidden {
		return &ValidateResult{Valid: true, Status: ValidityActive, Identity: "key exists but secret not validated"}
	}
	return &ValidateResult{Status: ValidityUnknown}
}

func (v *SecretValidator) validateGitHubToken(ctx context.Context, token string) *ValidateResult {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.github.com/user", nil)
	if err != nil {
		return &ValidateResult{Status: ValidityUnknown, Error: err.Error()}
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := v.httpClient.Do(req)
	if err != nil {
		return &ValidateResult{Status: ValidityUnknown, Error: err.Error()}
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusOK {
		var user struct {
			Login string `json:"login"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&user); err == nil {
			return &ValidateResult{Valid: true, Status: ValidityActive, Identity: user.Login}
		}
		return &ValidateResult{Valid: true, Status: ValidityActive}
	}
	return &ValidateResult{Status: ValidityInvalid}
}

func (v *SecretValidator) validateGitLabToken(ctx context.Context, token string) *ValidateResult {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://gitlab.com/api/v4/user", nil)
	if err != nil {
		return &ValidateResult{Status: ValidityUnknown, Error: err.Error()}
	}
	req.Header.Set("PRIVATE-TOKEN", token)

	resp, err := v.httpClient.Do(req)
	if err != nil {
		return &ValidateResult{Status: ValidityUnknown, Error: err.Error()}
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusOK {
		var user struct {
			Username string `json:"username"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&user); err == nil {
			return &ValidateResult{Valid: true, Status: ValidityActive, Identity: user.Username}
		}
		return &ValidateResult{Valid: true, Status: ValidityActive}
	}
	return &ValidateResult{Status: ValidityInvalid}
}

func (v *SecretValidator) validateSlackToken(ctx context.Context, token string) *ValidateResult {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://slack.com/api/auth.test", nil)
	if err != nil {
		return &ValidateResult{Status: ValidityUnknown, Error: err.Error()}
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := v.httpClient.Do(req)
	if err != nil {
		return &ValidateResult{Status: ValidityUnknown, Error: err.Error()}
	}
	defer func() { _ = resp.Body.Close() }()

	var result struct {
		OK    bool   `json:"ok"`
		Team  string `json:"team"`
		User  string `json:"user"`
		Error string `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return &ValidateResult{Status: ValidityUnknown, Error: err.Error()}
	}
	if result.OK {
		return &ValidateResult{Valid: true, Status: ValidityActive, Identity: result.User + "@" + result.Team}
	}
	if result.Error == "token_revoked" || result.Error == "invalid_auth" {
		return &ValidateResult{Status: ValidityInvalid}
	}
	return &ValidateResult{Status: ValidityUnknown, Error: result.Error}
}

func (v *SecretValidator) validateJWT(token string) *ValidateResult {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return &ValidateResult{Status: ValidityInvalid}
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return &ValidateResult{Status: ValidityUnknown, Error: fmt.Sprintf("base64 decode: %v", err)}
	}

	var claims struct {
		Exp int64 `json:"exp"`
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return &ValidateResult{Status: ValidityUnknown, Error: "cannot parse claims"}
	}

	if claims.Exp == 0 {
		return &ValidateResult{Status: ValidityUnknown, Identity: "no exp claim"}
	}

	expAt := time.Unix(claims.Exp, 0)
	if time.Now().After(expAt) {
		return &ValidateResult{Status: ValidityExpired, ExpiresAt: &expAt}
	}
	return &ValidateResult{Valid: true, Status: ValidityActive, ExpiresAt: &expAt}
}
