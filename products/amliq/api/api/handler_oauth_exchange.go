package api

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"

	"github.com/aegis-aml/aegis/internal/config"
)

func exchangeCode(
	p config.OAuthProvider, code, apiURL string, r *http.Request,
) (string, error) {
	callbackURL := fmt.Sprintf("%s/auth/oauth/%s/callback",
		strings.TrimRight(apiURL, "/"), r.PathValue("provider"))

	data := url.Values{
		"client_id":     {p.ClientID},
		"client_secret": {p.ClientSecret},
		"code":          {code},
		"redirect_uri":  {callbackURL},
		"grant_type":    {"authorization_code"},
	}
	req, err := http.NewRequest("POST", p.TokenURL,
		strings.NewReader(data.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		parsed, _ := url.ParseQuery(string(body))
		if t := parsed.Get("access_token"); t != "" {
			return t, nil
		}
	}
	if t, ok := result["access_token"].(string); ok {
		return t, nil
	}
	log.Printf("oauth: token exchange failed (status %d)", resp.StatusCode)
	return "", fmt.Errorf("no access_token in response")
}
