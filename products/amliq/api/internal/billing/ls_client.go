package billing

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type LemonSqueezyClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

func NewLemonSqueezyClient(apiKey string) *LemonSqueezyClient {
	return &LemonSqueezyClient{
		baseURL: "https://api.lemonsqueezy.com/v1",
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (c *LemonSqueezyClient) newRequest(method, path string, body interface{}) (*http.Request, error) {
	url := c.baseURL + path
	var bodyReader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewReader(data)
	}
	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	return req, nil
}

func (c *LemonSqueezyClient) do(req *http.Request, result interface{}) error {
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if resp.StatusCode >= 400 {
		return fmt.Errorf("LS API error: status %d, body: %s", resp.StatusCode, string(data))
	}

	if result != nil && len(data) > 0 {
		if err := json.Unmarshal(data, result); err != nil {
			return err
		}
	}
	return nil
}

func (c *LemonSqueezyClient) GetSubscription(subscriptionID string) (map[string]interface{}, error) {
	req, err := c.newRequest("GET", "/subscriptions/"+subscriptionID, nil)
	if err != nil {
		return nil, err
	}
	var result map[string]interface{}
	if err := c.do(req, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *LemonSqueezyClient) UpdateSubscription(subscriptionID string, data map[string]interface{}) error {
	req, err := c.newRequest("PATCH", "/subscriptions/"+subscriptionID, map[string]interface{}{"data": data})
	if err != nil {
		return err
	}
	return c.do(req, nil)
}

func (c *LemonSqueezyClient) CancelSubscription(subscriptionID string) error {
	req, err := c.newRequest("DELETE", "/subscriptions/"+subscriptionID, nil)
	if err != nil {
		return err
	}
	return c.do(req, nil)
}
