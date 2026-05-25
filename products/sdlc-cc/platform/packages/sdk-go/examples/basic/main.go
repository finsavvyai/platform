//go:build never
// +build never

package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/SDLC/sdln-sdk-go/pkg/auth"
	"github.com/SDLC/sdln-sdk-go/pkg/middleware"
	"github.com/SDLC/sdln-sdk-go/pkg/sdln"
)

func main() {
	// Example 1: Basic SDK usage
	fmt.Println("=== SDLC.ai Go SDK - Basic Example ===")

	// Configure the client
	config := &sdln.Config{
		BaseURL:     "https://api.sdlc.cc",
		Timeout:     30 * time.Second,
		RetryConfig: sdln.DefaultRetryConfig(),
		Debug:       true,
	}

	// Create client with API key authentication
	client, err := sdln.NewClient(
		config,
		auth.WithAPIKey("your-api-key-here"),
	)
	if err != nil {
		log.Fatalf("Failed to create client: %v", err)
	}
	defer client.Close()

	// Example 2: Create a tenant
	fmt.Println("\n--- Creating Tenant ---")
	tenant, err := client.Tenants.Create(context.Background(), &sdln.CreateTenantRequest{
		Name:   "Example Tenant",
		Domain: "example.sdlc.cc",
		Settings: sdln.TenantSettings{
			MaxUsers:        100,
			MaxDocuments:    10000,
			MaxStorage:      10240, // 10GB in MB
			AllowSSO:        true,
			RequireMFA:      false,
			DataRetention:   365,
			EnableAudit:     true,
			EncryptionLevel: "high",
		},
		Metadata: map[string]string{
			"environment": "development",
			"version":     "1.0.0",
		},
		IsEnterprise: true,
	})
	if err != nil {
		log.Printf("Failed to create tenant: %v", err)
	} else {
		fmt.Printf("Created tenant: %s (ID: %s)\n", tenant.Name, tenant.ID)
	}

	// Example 3: Create a user
	fmt.Println("\n--- Creating User ---")
	user, err := client.Users.Create(context.Background(), &sdln.CreateUserRequest{
		Email:     "john.doe@example.com",
		FirstName: "John",
		LastName:  "Doe",
		Role:      "admin",
		TenantID:  tenant.ID,
		IsActive:  true,
		Preferences: map[string]string{
			"theme":  "dark",
			"locale": "en-US",
		},
		Metadata: map[string]string{
			"department": "engineering",
		},
	})
	if err != nil {
		log.Printf("Failed to create user: %v", err)
	} else {
		fmt.Printf("Created user: %s %s (ID: %s)\n", user.FirstName, user.LastName, user.ID)
	}

	// Example 4: List users
	fmt.Println("\n--- Listing Users ---")
	users, err := client.Users.List(context.Background(), &sdln.ListOptions{
		Page:     1,
		PageSize: 10,
		SortBy:   "created_at",
		SortDesc: true,
	})
	if err != nil {
		log.Printf("Failed to list users: %v", err)
	} else {
		fmt.Printf("Found %d users (page %d of %d)\n", len(users.Data), users.Pagination.Page, users.Pagination.TotalPages)
		for i, user := range users.Data {
			fmt.Printf("  %d. %s %s (%s)\n", i+1, user.FirstName, user.LastName, user.Email)
		}
	}

	// Example 5: Upload a document
	fmt.Println("\n--- Uploading Document ---")
	document, err := client.Documents.UploadFromPath(
		context.Background(),
		"./example.txt", // Make sure this file exists
		tenant.ID,
		sdln.DocumentMetadata{
			Title:       "Example Document",
			Description: "This is an example document for testing",
			Author:      "John Doe",
			Language:    "en",
			Category:    "documentation",
			CustomFields: map[string]string{
				"project": "example-project",
				"version": "1.0",
			},
		},
	)
	if err != nil {
		log.Printf("Failed to upload document: %v", err)
	} else {
		fmt.Printf("Uploaded document: %s (ID: %s, Size: %d bytes)\n", document.Filename, document.ID, document.Size)
	}

	// Example 6: Search documents
	fmt.Println("\n--- Searching Documents ---")
	searchResults, err := client.Documents.Search(context.Background(), "example", &sdln.SearchOptions{
		Page:     1,
		PageSize: 5,
		SortBy:   "created_at",
		SortDesc: true,
		Filters: []sdln.Filter{
			{Field: "tenant_id", Op: "eq", Value: tenant.ID},
		},
	})
	if err != nil {
		log.Printf("Failed to search documents: %v", err)
	} else {
		fmt.Printf("Found %d documents matching 'example'\n", len(searchResults.Results))
		for i, doc := range searchResults.Results {
			fmt.Printf("  %d. %s (%s)\n", i+1, doc.Filename, doc.ContentType)
		}
	}

	// Example 7: RAG Query
	fmt.Println("\n--- RAG Query ---")
	ragResponse, err := client.RAG.Query(context.Background(), &sdln.QueryRequest{
		Query:    "What is this document about?",
		TenantID: tenant.ID,
		ContextOptions: &sdln.ContextOptions{
			MaxContextLength: 4000,
			MaxChunks:        5,
			MinSimilarity:    0.7,
			Strategy:         "hybrid",
			IncludeCitations: true,
		},
		RetrievalOptions: &sdln.RetrievalOptions{
			SearchType: "hybrid",
			MaxResults: 10,
			Rerank:     true,
		},
		GenerationOptions: &sdln.GenerationOptions{
			Model:          "gpt-3.5-turbo",
			MaxTokens:      1000,
			Temperature:    0.7,
			ResponseFormat: "text",
		},
	})
	if err != nil {
		log.Printf("Failed to perform RAG query: %v", err)
	} else {
		fmt.Printf("RAG Query completed (confidence: %.2f)\n", ragResponse.Confidence)
		fmt.Printf("Answer: %s\n", ragResponse.Answer)
		fmt.Printf("Used %d context sources\n", len(ragResponse.Context))
	}

	// Example 8: Create vectors
	fmt.Println("\n--- Creating Vectors ---")
	vectors, err := client.Vector.Create(context.Background(), &sdln.VectorCreateRequest{
		TenantID: tenant.ID,
		Vectors: []sdln.VectorInput{
			{
				ID:     "doc1-chunk1",
				Values: []float64{0.1, 0.2, 0.3, 0.4, 0.5},
				Metadata: map[string]interface{}{
					"document_id": document.ID,
					"chunk_index": 0,
					"text":        "This is the first chunk of the document",
				},
			},
			{
				ID:     "doc1-chunk2",
				Values: []float64{0.2, 0.3, 0.4, 0.5, 0.6},
				Metadata: map[string]interface{}{
					"document_id": document.ID,
					"chunk_index": 1,
					"text":        "This is the second chunk of the document",
				},
			},
		},
		Namespace:   "documents",
		WaitForSync: true,
	})
	if err != nil {
		log.Printf("Failed to create vectors: %v", err)
	} else {
		fmt.Printf("Created %d vectors, %d failed\n", len(vectors.CreatedIDs), len(vectors.FailedIDs))
	}

	// Example 9: Vector search
	fmt.Println("\n--- Vector Search ---")
	searchResponse, err := client.Vector.Search(context.Background(), &sdln.SearchRequest{
		TenantID:        tenant.ID,
		Vector:          []float64{0.15, 0.25, 0.35, 0.45, 0.55},
		TopK:            5,
		Namespace:       "documents",
		IncludeVector:   false,
		IncludeMetadata: true,
		SearchParams: &sdln.SearchParams{
			EF: 100,
		},
	})
	if err != nil {
		log.Printf("Failed to search vectors: %v", err)
	} else {
		fmt.Printf("Vector search completed in %v, found %d results\n", searchResponse.Time, len(searchResponse.Results))
		for i, result := range searchResponse.Results {
			fmt.Printf("  %d. ID: %s, Score: %.4f\n", i+1, result.ID, result.Score)
		}
	}

	// Example 10: Create a policy
	fmt.Println("\n--- Creating Policy ---")
	policy, err := client.Policies.Create(context.Background(), &sdln.CreatePolicyRequest{
		Name:        "Document Access Policy",
		Description: "Controls access to documents based on user role and document classification",
		Type:        "access",
		Category:    "document",
		Rules: []sdln.PolicyRule{
			{
				ID:       "role-check",
				Name:     "Role Check",
				Type:     "attribute",
				Operator: "equals",
				Field:    "user.role",
				Value:    "admin",
			},
			{
				ID:       "classification-check",
				Name:     "Classification Check",
				Type:     "attribute",
				Operator: "in",
				Field:    "document.classification",
				Value:    []string{"public", "internal"},
			},
		},
		Conditions: []sdln.PolicyCondition{
			{
				ID:       "business-hours",
				Name:     "Business Hours Only",
				Type:     "time",
				Operator: "between",
				Field:    "hour",
				Value:    []int{9, 17},
			},
		},
		Actions: []sdln.PolicyAction{
			{
				ID:   "allow-access",
				Type: "allow",
				Parameters: map[string]interface{}{
					"audit": true,
				},
			},
		},
		Effect:   "allow",
		Priority: 1,
		Metadata: map[string]interface{}{
			"version":     "1.0",
			"author":      "security-team",
			"last_review": time.Now().Format("2006-01-02"),
		},
	})
	if err != nil {
		log.Printf("Failed to create policy: %v", err)
	} else {
		fmt.Printf("Created policy: %s (ID: %s)\n", policy.Name, policy.ID)
	}

	// Example 11: Evaluate policy
	fmt.Println("\n--- Evaluating Policy ---")
	evaluation, err := client.Policies.Evaluate(context.Background(), &sdln.PolicyEvaluationRequest{
		TenantID: tenant.ID,
		UserID:   user.ID,
		Resource: fmt.Sprintf("document:%s", document.ID),
		Action:   "read",
		Context: map[string]interface{}{
			"hour":        14,
			"ip_address":  "192.168.1.100",
			"user_agent":  "Mozilla/5.0...",
			"device_type": "desktop",
		},
		Attributes: map[string]interface{}{
			"user": map[string]interface{}{
				"role":       "admin",
				"department": "engineering",
			},
			"document": map[string]interface{}{
				"classification": "internal",
				"owner":          "john.doe@example.com",
			},
		},
	})
	if err != nil {
		log.Printf("Failed to evaluate policy: %v", err)
	} else {
		fmt.Printf("Policy evaluation: %s (Effect: %s)\n",
			map[bool]string{true: "Allowed", false: "Denied"}[evaluation.Allowed],
			evaluation.Effect)
		fmt.Printf("Reason: %s\n", evaluation.Reason)
	}

	// Example 12: LLM Chat Completion
	fmt.Println("\n--- LLM Chat Completion ---")
	chatResponse, err := client.LLM.CreateChatCompletion(context.Background(), &sdln.ChatCompletionRequest{
		Model: "gpt-3.5-turbo",
		Messages: []sdln.ChatMessage{
			{
				Role:    "system",
				Content: "You are a helpful assistant that provides concise answers.",
			},
			{
				Role:    "user",
				Content: "What are the key features of the SDLC.ai platform?",
			},
		},
		MaxTokens:   500,
		Temperature: &[]float64{0.7}[0],
		TenantID:    tenant.ID,
	})
	if err != nil {
		log.Printf("Failed to create chat completion: %v", err)
	} else {
		fmt.Printf("Chat completion completed (Model: %s)\n", chatResponse.Model)
		if len(chatResponse.Choices) > 0 {
			fmt.Printf("Response: %s\n", chatResponse.Choices[0].Message.Content)
		}
		if chatResponse.Usage != nil {
			fmt.Printf("Token usage: %d prompt, %d completion, %d total\n",
				chatResponse.Usage.PromptTokens,
				chatResponse.Usage.CompletionTokens,
				chatResponse.Usage.TotalTokens)
		}
	}

	// Example 13: Create embeddings
	fmt.Println("\n--- Creating Embeddings ---")
	embeddingResponse, err := client.LLM.CreateEmbedding(context.Background(), &sdln.EmbeddingRequest{
		Model:    "text-embedding-ada-002",
		Input:    []string{"This is a sample text for embedding generation."},
		TenantID: tenant.ID,
	})
	if err != nil {
		log.Printf("Failed to create embeddings: %v", err)
	} else {
		fmt.Printf("Created embeddings (Model: %s)\n", embeddingResponse.Model)
		if len(embeddingResponse.Data) > 0 {
			fmt.Printf("Embedding dimensions: %d\n", len(embeddingResponse.Data[0].Embedding))
		}
		if embeddingResponse.Usage != nil {
			fmt.Printf("Token usage: %d prompt, %d total\n",
				embeddingResponse.Usage.PromptTokens,
				embeddingResponse.Usage.TotalTokens)
		}
	}

	// Example 14: Push metrics
	fmt.Println("\n--- Pushing Metrics ---")
	err = client.Monitoring.PushMetrics(context.Background(), tenant.ID, []sdln.Metric{
		{
			Name:      "api_requests_total",
			Value:     42.0,
			Timestamp: sdln.NowTime(),
			Labels: map[string]string{
				"method":   "GET",
				"endpoint": "/users",
				"status":   "200",
			},
			Unit: "count",
			Type: "counter",
		},
		{
			Name:      "response_time_seconds",
			Value:     0.123,
			Timestamp: sdln.NowTime(),
			Labels: map[string]string{
				"method":   "GET",
				"endpoint": "/users",
			},
			Unit: "seconds",
			Type: "histogram",
		},
	})
	if err != nil {
		log.Printf("Failed to push metrics: %v", err)
	} else {
		fmt.Printf("Successfully pushed metrics\n")
	}

	// Example 15: Get health status
	fmt.Println("\n--- Health Check ---")
	health, err := client.Monitoring.GetHealth(context.Background(), tenant.ID, []string{"database", "api", "storage"})
	if err != nil {
		log.Printf("Failed to get health status: %v", err)
	} else {
		fmt.Printf("Health status: %s\n", health.Status)
		for _, check := range health.Checks {
			fmt.Printf("  %s: %s (%v)\n", check.Name, check.Status, check.Duration)
		}
	}

	// Example 16: WebSocket connection
	fmt.Println("\n--- WebSocket Connection ---")
	conn, err := client.WebSocket.Connect(context.Background())
	if err != nil {
		log.Printf("Failed to connect WebSocket: %v", err)
	} else {
		defer conn.Close()

		fmt.Printf("WebSocket connected\n")

		// Subscribe to events
		err = conn.Subscribe(&sdln.SubscribeRequest{
			Events:   []string{"document.created", "user.updated", "policy.evaluated"},
			TenantID: tenant.ID,
		})
		if err != nil {
			log.Printf("Failed to subscribe to events: %v", err)
		} else {
			fmt.Printf("Subscribed to events\n")

			// Listen for events (with timeout)
			go func() {
				timeout := time.After(5 * time.Second)
				for {
					select {
					case event := <-conn.Events():
						fmt.Printf("Received event: %s\n", string(event))
					case err := <-conn.Errors():
						fmt.Printf("WebSocket error: %v\n", err)
						return
					case <-timeout:
						fmt.Printf("WebSocket listening timeout\n")
						return
					}
				}
			}()
		}

		// Wait a bit for events
		time.Sleep(2 * time.Second)
	}

	fmt.Println("\n=== Basic Example Complete ===")
}

// Helper function to create a logger
func createLogger() middleware.Logger {
	return middleware.NewDefaultLogger(middleware.LogLevelInfo)
}

// Helper function to create metrics collector
func createMetricsCollector() middleware.MetricsCollector {
	return middleware.NewDefaultMetricsCollector()
}
