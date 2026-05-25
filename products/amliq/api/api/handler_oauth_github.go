package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

func parseGitHub(raw map[string]interface{}) oauthUserInfo {
	return oauthUserInfo{
		ID:    fmt.Sprintf("%v", raw["id"]),
		Email: strVal(raw, "email"),
		Name:  strVal(raw, "name"),
	}
}

// fetchGitHubEmail fetches the primary email when /user returns null email.
func fetchGitHubEmail(token string) string {
	req, err := http.NewRequest("GET", "https://api.github.com/user/emails", nil)
	if err != nil {
		return ""
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		return ""
	}
	defer resp.Body.Close()
	var emails []struct {
		Email   string `json:"email"`
		Primary bool   `json:"primary"`
	}
	body, _ := io.ReadAll(resp.Body)
	json.Unmarshal(body, &emails)
	for _, e := range emails {
		if e.Primary {
			return e.Email
		}
	}
	if len(emails) > 0 {
		return emails[0].Email
	}
	return ""
}
