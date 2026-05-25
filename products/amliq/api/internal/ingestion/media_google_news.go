package ingestion

import (
	"context"
	"encoding/xml"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

// GoogleNewsClient fetches articles from Google News RSS.
type GoogleNewsClient struct {
	client *http.Client
}

func NewGoogleNewsClient() *GoogleNewsClient {
	return &GoogleNewsClient{
		client: &http.Client{Timeout: 15 * time.Second},
	}
}

type rssResponse struct {
	Channel struct {
		Items []rssItem `xml:"item"`
	} `xml:"channel"`
}

type rssItem struct {
	Title   string `xml:"title"`
	Link    string `xml:"link"`
	PubDate string `xml:"pubDate"`
	Source  string `xml:"source"`
}

// GoogleNewsArticle is a parsed Google News RSS entry.
type GoogleNewsArticle struct {
	Title       string
	URL         string
	Source      string
	PublishedAt string
}

// Search queries Google News RSS for articles mentioning the entity.
func (c *GoogleNewsClient) Search(
	ctx context.Context, query string, maxResults int,
) ([]GoogleNewsArticle, error) {
	u := fmt.Sprintf(
		"https://news.google.com/rss/search?q=%s&hl=en-US&gl=US&ceid=US:en",
		url.QueryEscape(query),
	)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("google news: %w", err)
	}
	defer resp.Body.Close()

	var rss rssResponse
	if err := xml.NewDecoder(resp.Body).Decode(&rss); err != nil {
		return nil, fmt.Errorf("google news decode: %w", err)
	}

	var articles []GoogleNewsArticle
	for i, item := range rss.Channel.Items {
		if maxResults > 0 && i >= maxResults {
			break
		}
		articles = append(articles, GoogleNewsArticle{
			Title:       item.Title,
			URL:         item.Link,
			Source:      item.Source,
			PublishedAt: item.PubDate,
		})
	}
	return articles, nil
}
