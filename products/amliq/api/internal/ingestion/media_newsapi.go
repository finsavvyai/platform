package ingestion

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

// NewsAPIClient fetches articles from NewsAPI.org.
type NewsAPIClient struct {
	apiKey string
	client *http.Client
}

func NewNewsAPIClient(apiKey string) *NewsAPIClient {
	return &NewsAPIClient{
		apiKey: apiKey,
		client: &http.Client{Timeout: 15 * time.Second},
	}
}

// NewsAPIArticle represents a single article from NewsAPI.
type NewsAPIArticle struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	URL         string `json:"url"`
	Source      struct {
		Name string `json:"name"`
	} `json:"source"`
	PublishedAt string `json:"publishedAt"`
}

// Search queries NewsAPI for articles matching the given entity name.
func (c *NewsAPIClient) Search(
	ctx context.Context, query string, maxResults int,
) ([]NewsAPIArticle, error) {
	if maxResults <= 0 {
		maxResults = 10
	}
	u := fmt.Sprintf(
		"https://newsapi.org/v2/everything?q=%s&pageSize=%d&sortBy=publishedAt&language=en",
		url.QueryEscape(query), maxResults,
	)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Api-Key", c.apiKey)

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("newsapi request: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Articles []NewsAPIArticle `json:"articles"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("newsapi decode: %w", err)
	}
	return result.Articles, nil
}
