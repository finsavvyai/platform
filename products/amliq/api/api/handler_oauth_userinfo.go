package api

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/aegis-aml/aegis/internal/config"
)

func fetchUserInfo(p config.OAuthProvider, token, provider string) (oauthUserInfo, error) {
	req, err := http.NewRequest("GET", p.UserInfoURL, nil)
	if err != nil {
		return oauthUserInfo{}, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	if provider == "github" {
		req.Header.Set("Accept", "application/vnd.github+json")
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return oauthUserInfo{}, fmt.Errorf("userinfo request: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		log.Printf("oauth: userinfo %s returned %d: %s", provider, resp.StatusCode, string(body))
		return oauthUserInfo{}, fmt.Errorf("userinfo returned %d", resp.StatusCode)
	}

	var raw map[string]interface{}
	json.Unmarshal(body, &raw)

	info := oauthUserInfo{}
	switch provider {
	case "github":
		info = parseGitHub(raw)
		if info.Email == "" {
			info.Email = fetchGitHubEmail(token)
		}
	case "google":
		info = parseGoogle(raw)
	case "microsoft":
		info = parseMicrosoft(raw)
	case "linkedin":
		info = parseLinkedIn(raw)
	}

	if info.Email == "" {
		return oauthUserInfo{}, fmt.Errorf("no email returned from %s", provider)
	}
	return info, nil
}

// parseGitHub + fetchGitHubEmail are in handler_oauth_github.go

func parseGoogle(raw map[string]interface{}) oauthUserInfo {
	return oauthUserInfo{
		ID:    strVal(raw, "id"),
		Email: strVal(raw, "email"),
		Name:  strVal(raw, "name"),
	}
}

func parseMicrosoft(raw map[string]interface{}) oauthUserInfo {
	email := strVal(raw, "mail")
	if email == "" {
		email = strVal(raw, "userPrincipalName")
	}
	return oauthUserInfo{
		ID:    strVal(raw, "id"),
		Email: email,
		Name:  strVal(raw, "displayName"),
	}
}

func parseLinkedIn(raw map[string]interface{}) oauthUserInfo {
	return oauthUserInfo{
		ID:    strVal(raw, "sub"),
		Email: strVal(raw, "email"),
		Name:  strVal(raw, "name"),
	}
}

func strVal(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok && v != nil {
		return fmt.Sprintf("%v", v)
	}
	return ""
}
