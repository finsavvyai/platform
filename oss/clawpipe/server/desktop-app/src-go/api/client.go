package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Client for Python cluster API
type ClusterClient struct {
	baseURL    string
	httpClient *http.Client
}

func NewClusterClient(masterHost string, masterPort int) *ClusterClient {
	return &ClusterClient{
		baseURL: fmt.Sprintf("http://%s:%d", masterHost, masterPort),
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *ClusterClient) GetStatus(ctx context.Context) (*ClusterStatus, error) {
	resp, err := c.httpClient.Get(c.baseURL + "/cluster/status")
	if err != nil {
		return nil, fmt.Errorf("failed to get cluster status: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("cluster status request failed: %d", resp.StatusCode)
	}

	var status ClusterStatus
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return nil, fmt.Errorf("failed to decode cluster status: %w", err)
	}

	return &status, nil
}

func (c *ClusterClient) GetNodes(ctx context.Context) ([]ClusterNode, error) {
	resp, err := c.httpClient.Get(c.baseURL + "/cluster/nodes")
	if err != nil {
		return nil, fmt.Errorf("failed to get nodes: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("get nodes request failed: %d", resp.StatusCode)
	}

	var response struct {
		Nodes []ClusterNode `json:"nodes"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode nodes response: %w", err)
	}

	return response.Nodes, nil
}

func (c *ClusterClient) RegisterNode(ctx context.Context, nodeConfig *NodeRegistration) error {
	jsonData, err := json.Marshal(nodeConfig)
	if err != nil {
		return fmt.Errorf("failed to marshal node config: %w", err)
	}

	resp, err := c.httpClient.Post(
		c.baseURL+"/cluster/join",
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return fmt.Errorf("failed to register node: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("node registration failed: %d", resp.StatusCode)
	}

	return nil
}

func (c *ClusterClient) SendHeartbeat(ctx context.Context, nodeID string, heartbeat *Heartbeat) error {
	jsonData, err := json.Marshal(heartbeat)
	if err != nil {
		return fmt.Errorf("failed to marshal heartbeat: %w", err)
	}

	url := fmt.Sprintf("%s/cluster/heartbeat", c.baseURL)
	resp, err := c.httpClient.Post(
		url,
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return fmt.Errorf("failed to send heartbeat: %w", err)
	}
	defer resp.Body.Close()

	return nil
}

func (c *ClusterClient) SendCompletion(ctx context.Context, request *CompletionRequest) (*CompletionResponse, error) {
	jsonData, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal completion request: %w", err)
	}

	resp, err := c.httpClient.Post(
		c.baseURL+"/cluster/completions",
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to send completion request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("completion request failed: %d", resp.StatusCode)
	}

	var response CompletionResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode completion response: %w", err)
	}

	return &response, nil
}

// Request/Response types for Python API
type NodeRegistration struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	Host         string            `json:"host"`
	Port         int               `json:"port"`
	Models       []string          `json:"models"`
	Capabilities map[string]string `json:"capabilities"`
	MaxLoad      int               `json:"max_load"`
}

type Heartbeat struct {
	ID     string `json:"id"`
	Status string `json:"status"`
	Load   int    `json:"load"`
}

type CompletionRequest struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
}

type CompletionResponse struct {
	ID      string    `json:"id"`
	Object  string    `json:"object"`
	Created time.Time `json:"created"`
	Model   string    `json:"model"`
	Choices []Choice  `json:"choices"`
	Usage   Usage     `json:"usage"`
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type Choice struct {
	Index        int     `json:"index"`
	Message      Message `json:"message"`
	FinishReason string  `json:"finish_reason"`
}

type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}
