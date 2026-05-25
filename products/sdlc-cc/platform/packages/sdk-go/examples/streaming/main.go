//go:build never
// +build never

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand/v2"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/SDLC/sdln-sdk-go/pkg/auth"
	"github.com/SDLC/sdln-sdk-go/pkg/sdln"
)

func main() {
	fmt.Println("=== SDLC.ai Go SDK - Streaming Example ===")

	// Configure client for streaming operations
	config := &sdln.Config{
		BaseURL:     "https://api.sdlc.cc",
		Timeout:     300 * time.Second, // Longer timeout for streaming
		RetryConfig: sdln.DefaultRetryConfig(),
		Debug:       false,
	}

	client, err := sdln.NewClient(
		config,
		auth.WithAPIKey("your-api-key-here"),
	)
	if err != nil {
		log.Fatalf("Failed to create client: %v", err)
	}
	defer client.Close()

	// Create a tenant for streaming examples
	tenant, err := createTestTenant(client)
	if err != nil {
		log.Fatalf("Failed to create test tenant: %v", err)
	}

	// Example 1: RAG Streaming Query
	fmt.Println("\n--- RAG Streaming Query ---")
	err = ragStreamingExample(client, tenant.ID)
	if err != nil {
		log.Printf("RAG streaming example failed: %v", err)
	}

	// Example 2: LLM Streaming Chat Completion
	fmt.Println("\n--- LLM Streaming Chat Completion ---")
	err = llmStreamingExample(client, tenant.ID)
	if err != nil {
		log.Printf("LLM streaming example failed: %v", err)
	}

	// Example 3: WebSocket Real-time Events
	fmt.Println("\n--- WebSocket Real-time Events ---")
	err = websocketExample(client, tenant.ID)
	if err != nil {
		log.Printf("WebSocket example failed: %v", err)
	}

	// Example 4: Streaming Document Processing
	fmt.Println("\n--- Streaming Document Processing ---")
	err = streamingDocumentProcessing(client, tenant.ID)
	if err != nil {
		log.Printf("Streaming document processing example failed: %v", err)
	}

	// Example 5: Real-time Metrics Streaming
	fmt.Println("\n--- Real-time Metrics Streaming ---")
	err = realTimeMetricsStreaming(client, tenant.ID)
	if err != nil {
		log.Printf("Real-time metrics streaming example failed: %v", err)
	}

	fmt.Println("\n=== Streaming Example Complete ===")
}

// createTestTenant creates a test tenant for the examples
func createTestTenant(client *sdln.Client) (*sdln.Tenant, error) {
	ctx := context.Background()

	tenant, err := client.Tenants.Create(ctx, &sdln.CreateTenantRequest{
		Name:   "Streaming Example Tenant",
		Domain: "streaming.sdlc.cc",
		Settings: sdln.TenantSettings{
			MaxUsers:        100,
			MaxDocuments:    1000,
			MaxStorage:      51200, // 50GB
			AllowSSO:        true,
			RequireMFA:      false,
			DataRetention:   365,
			EnableAudit:     true,
			EncryptionLevel: "high",
		},
		Metadata: map[string]string{
			"environment": "development",
			"purpose":     "streaming-examples",
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create tenant: %w", err)
	}

	fmt.Printf("Created test tenant: %s (ID: %s)\n", tenant.Name, tenant.ID)
	return tenant, nil
}

// ragStreamingExample demonstrates RAG streaming queries
func ragStreamingExample(client *sdln.Client, tenantID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Create a streaming RAG query
	queryRequest := &sdln.QueryRequest{
		Query:    "Explain the key features of vector databases and their use cases in AI applications. Provide a comprehensive overview with examples.",
		TenantID: tenantID,
		ContextOptions: &sdln.ContextOptions{
			MaxContextLength: 8000,
			MaxChunks:        10,
			MinSimilarity:    0.6,
			Strategy:         "hybrid",
			IncludeCitations: true,
			RecencyWeight:    0.2,
			AuthorityWeight:  0.3,
			DiversityWeight:  0.2,
		},
		RetrievalOptions: &sdln.RetrievalOptions{
			SearchType:  "hybrid",
			VectorIndex: "default",
			Rerank:      true,
			RerankModel: "rerank-v1",
			MaxResults:  15,
		},
		GenerationOptions: &sdln.GenerationOptions{
			Model:            "gpt-4",
			MaxTokens:        2000,
			Temperature:      0.7,
			TopP:             0.9,
			FrequencyPenalty: 0.1,
			PresencePenalty:  0.1,
			ResponseFormat:   "markdown",
			SystemPrompt:     "You are a helpful AI assistant that provides detailed, accurate information about vector databases and AI applications.",
		},
		Stream: true,
		Metadata: map[string]string{
			"example": "rag-streaming",
			"session": "example-session-1",
		},
	}

	fmt.Printf("Starting RAG streaming query: %s\n", queryRequest.Query)

	// Start streaming
	stream, err := client.RAG.QueryStream(ctx, queryRequest)
	if err != nil {
		return fmt.Errorf("failed to start RAG stream: %w", err)
	}

	// Set up signal handling for graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	var (
		fullResponse  strings.Builder
		chunkCount    int
		contextChunks []sdln.ContextChunk
		citations     []sdln.Citation
		queryID       string
		lastChunkTime time.Time
	)

	// Process stream
	for {
		select {
		case <-ctx.Done():
			fmt.Printf("\nStream completed due to context timeout\n")
			goto summarize

		case <-sigChan:
			fmt.Printf("\nStream interrupted by user\n")
			goto summarize

		case chunk, ok := <-stream:
			if !ok {
				fmt.Printf("\nStream completed naturally\n")
				goto summarize
			}

			if chunk.Error != nil {
				fmt.Printf("Stream error: %v\n", chunk.Error)
				return chunk.Error
			}

			lastChunkTime = time.Now()
			chunkCount++

			switch chunk.Type {
			case "start":
				queryID = chunk.QueryID
				fmt.Printf("Stream started (Query ID: %s)\n", queryID)
				fmt.Printf("--- Response ---\n")

			case "chunk":
				fmt.Print(chunk.Content)
				fullResponse.WriteString(chunk.Content)

			case "context":
				if chunk.Chunk != nil {
					contextChunks = append(contextChunks, *chunk.Chunk)
					fmt.Printf("\n[Context source: %s (score: %.3f)]\n",
						chunk.Chunk.DocumentTitle, chunk.Chunk.Score)
				}

			case "citation":
				if chunk.Citation != nil {
					citations = append(citations, *chunk.Citation)
					fmt.Printf("\n[Citation: %s]\n", chunk.Citation.Title)
				}

			case "end":
				fmt.Printf("\n--- Stream End ---\n")
				goto summarize

			default:
				fmt.Printf("Unknown chunk type: %s\n", chunk.Type)
			}

		case <-time.After(5 * time.Second):
			if chunkCount > 0 && time.Since(lastChunkTime) > 5*time.Second {
				fmt.Printf("\nStream appears to have stalled\n")
				goto summarize
			}
		}
	}

summarize:
	fmt.Printf("\n--- Stream Summary ---\n")
	fmt.Printf("Total chunks received: %d\n", chunkCount)
	fmt.Printf("Response length: %d characters\n", fullResponse.Len())
	fmt.Printf("Context sources used: %d\n", len(contextChunks))
	fmt.Printf("Citations generated: %d\n", len(citations))
	fmt.Printf("Total streaming time: %v\n", time.Since(time.Now().Add(-time.Since(lastChunkTime))))

	// Show first few context chunks
	if len(contextChunks) > 0 {
		fmt.Printf("\nTop context sources:\n")
		for i, chunk := range contextChunks[:min(3, len(contextChunks))] {
			fmt.Printf("  %d. %s (score: %.3f)\n", i+1, chunk.DocumentTitle, chunk.Score)
		}
	}

	// Show citations
	if len(citations) > 0 {
		fmt.Printf("\nCitations:\n")
		for i, citation := range citations[:min(3, len(citations))] {
			fmt.Printf("  %d. %s\n", i+1, citation.Title)
		}
	}

	return nil
}

// llmStreamingExample demonstrates LLM streaming chat completions
func llmStreamingExample(client *sdln.Client, tenantID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()

	// Create a streaming chat completion request
	chatRequest := &sdln.ChatCompletionRequest{
		Model: "gpt-3.5-turbo",
		Messages: []sdln.ChatMessage{
			{
				Role:    "system",
				Content: "You are a creative writing assistant. Write engaging, detailed stories based on user prompts.",
			},
			{
				Role:    "user",
				Content: "Write a short story about an AI assistant that helps a detective solve a complex mystery involving missing data. Include elements of technology, investigation, and unexpected twists.",
			},
		},
		MaxTokens:        1500,
		Temperature:      &[]float64{0.8}[0],
		TopP:             &[]float64{0.9}[0],
		FrequencyPenalty: &[]float64{0.1}[0],
		PresencePenalty:  &[]float64{0.1}[0],
		Stream:           true,
		TenantID:         tenantID,
		ResponseFormat:   "text",
		Metadata: map[string]string{
			"example":  "llm-streaming",
			"creative": "story-writing",
		},
	}

	fmt.Printf("Starting LLM streaming chat completion\n")
	fmt.Printf("Model: %s\n", chatRequest.Model)
	fmt.Printf("Max tokens: %d\n", chatRequest.MaxTokens)
	fmt.Printf("--- Story ---\n")

	// Start streaming
	stream, err := client.LLM.CreateChatCompletionStream(ctx, chatRequest)
	if err != nil {
		return fmt.Errorf("failed to start LLM stream: %w", err)
	}

	var (
		fullStory  strings.Builder
		chunkCount int
		lastChunk  string
		wordCount  int
		startTime  = time.Now()
	)

	// Process stream
	for {
		select {
		case <-ctx.Done():
			fmt.Printf("\nStream completed due to context timeout\n")
			goto done

		case chunk, ok := <-stream:
			if !ok {
				fmt.Printf("\nStream completed naturally\n")
				goto done
			}

			chunkCount++
			fmt.Print(chunk.Content)
			fullStory.WriteString(chunk.Content)
			lastChunk = chunk.Content

			// Count words (simple estimation)
			words := strings.Fields(chunk.Content)
			wordCount += len(words)

			// Add paragraph breaks periodically
			if strings.Contains(lastChunk, ".") && wordCount%50 == 0 {
				fmt.Printf("\n")
			}

		case <-time.After(10 * time.Second):
			fmt.Printf("\nStream appears to have stalled\n")
			goto done
		}
	}

done:
	duration := time.Since(startTime)
	storyLength := fullStory.Len()

	fmt.Printf("\n--- Story Summary ---\n")
	fmt.Printf("Total chunks received: %d\n", chunkCount)
	fmt.Printf("Story length: %d characters\n", storyLength)
	fmt.Printf("Estimated word count: %d\n", wordCount)
	fmt.Printf("Streaming duration: %v\n", duration)
	fmt.Printf("Average speed: %.2f chars/sec\n", float64(storyLength)/duration.Seconds())

	// Analyze the story
	if storyLength > 100 {
		sentences := strings.Count(fullStory.String(), ".") +
			strings.Count(fullStory.String(), "!") +
			strings.Count(fullStory.String(), "?")

		fmt.Printf("Estimated sentences: %d\n", sentences)
		fmt.Printf("Average sentence length: %.1f words\n", float64(wordCount)/float64(max(1, sentences)))
	}

	return nil
}

// websocketExample demonstrates WebSocket real-time events
func websocketExample(client *sdln.Client, tenantID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	fmt.Printf("Connecting to WebSocket for real-time events\n")

	// Connect to WebSocket
	conn, err := client.WebSocket.Connect(ctx)
	if err != nil {
		return fmt.Errorf("failed to connect WebSocket: %w", err)
	}
	defer conn.Close()

	fmt.Printf("WebSocket connected successfully\n")

	// Set up event handlers
	conn.SetMessageHandler(func(message []byte) {
		fmt.Printf("Received message: %s\n", string(message))
	})

	conn.SetErrorHandler(func(err error) {
		fmt.Printf("WebSocket error: %v\n", err)
	})

	conn.SetCloseHandler(func() {
		fmt.Printf("WebSocket connection closed\n")
	})

	// Subscribe to various events
	subscribeRequests := []*sdln.SubscribeRequest{
		{
			Events:   []string{"document.created", "document.updated", "document.deleted"},
			TenantID: tenantID,
			Filters: map[string]string{
				"type": "document",
			},
		},
		{
			Events:   []string{"user.created", "user.updated", "user.login"},
			TenantID: tenantID,
			Filters: map[string]string{
				"type": "user",
			},
		},
		{
			Events:   []string{"policy.evaluated", "policy.created", "policy.updated"},
			TenantID: tenantID,
			Filters: map[string]string{
				"type": "policy",
			},
		},
		{
			Events:   []string{"rag.query", "rag.feedback"},
			TenantID: tenantID,
			Filters: map[string]string{
				"type": "rag",
			},
		},
		{
			Events:   []string{"system.alert", "system.maintenance"},
			TenantID: tenantID,
			Filters: map[string]string{
				"type": "system",
			},
		},
	}

	for i, req := range subscribeRequests {
		err = conn.Subscribe(req)
		if err != nil {
			return fmt.Errorf("failed to subscribe to request %d: %w", i, err)
		}
		fmt.Printf("Subscribed to events: %v\n", req.Events)
	}

	fmt.Printf("Listening for events...\n")

	// Simulate some events by sending custom messages
	go func() {
		time.Sleep(2 * time.Second)
		conn.Send("test_event", map[string]interface{}{
			"type":      "simulation",
			"message":   "This is a test event",
			"timestamp": time.Now().Unix(),
		})

		time.Sleep(3 * time.Second)
		conn.Send("heartbeat", map[string]interface{}{
			"status": "active",
			"uptime": "10s",
		})
	}()

	// Listen for events with timeout
	eventCount := 0
	timeout := time.After(20 * time.Second)

	for {
		select {
		case <-ctx.Done():
			fmt.Printf("WebSocket context timeout\n")
			goto cleanup

		case <-timeout:
			fmt.Printf("WebSocket listening timeout\n")
			goto cleanup

		case event := <-conn.Events():
			eventCount++
			fmt.Printf("Event %d: %s\n", eventCount, string(event))

			// Try to parse as JSON for better formatting
			var eventData map[string]interface{}
			if err := json.Unmarshal(event, &eventData); err == nil {
				if eventType, ok := eventData["type"].(string); ok {
					fmt.Printf("  Type: %s\n", eventType)
				}
				if timestamp, ok := eventData["timestamp"].(float64); ok {
					fmt.Printf("  Time: %s\n", time.Unix(int64(timestamp), 0).Format("15:04:05"))
				}
			}

		case err := <-conn.Errors():
			fmt.Printf("WebSocket error received: %v\n", err)
			goto cleanup
		}

		// Exit after receiving some events or timeout
		if eventCount >= 5 {
			fmt.Printf("Received sufficient events, disconnecting\n")
			break
		}
	}

cleanup:
	fmt.Printf("--- WebSocket Summary ---\n")
	fmt.Printf("Total events received: %d\n", eventCount)
	fmt.Printf("Connection status: %v\n", conn.IsConnected())

	return nil
}

// streamingDocumentProcessing demonstrates streaming document processing
func streamingDocumentProcessing(client *sdln.Client, tenantID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	fmt.Printf("Starting streaming document processing example\n")

	// Simulate uploading multiple documents and processing them
	documents := []struct {
		name        string
		content     string
		contentType string
		metadata    sdln.DocumentMetadata
	}{
		{
			name:        "ai-research-paper.pdf",
			content:     "This is a comprehensive research paper on artificial intelligence...",
			contentType: "application/pdf",
			metadata: sdln.DocumentMetadata{
				Title:       "AI Research Paper",
				Description: "Comprehensive research on modern AI techniques",
				Author:      "Dr. Jane Smith",
				Language:    "en",
				Category:    "research",
				CustomFields: map[string]string{
					"peer_reviewed": "true",
					"journal":       "AI Journal",
					"year":          "2024",
				},
			},
		},
		{
			name:        "product-specification.docx",
			content:     "Product specification document with detailed requirements...",
			contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			metadata: sdln.DocumentMetadata{
				Title:       "Product Specification",
				Description: "Detailed product requirements and specifications",
				Author:      "Product Team",
				Language:    "en",
				Category:    "business",
				CustomFields: map[string]string{
					"version":    "2.1",
					"department": "engineering",
					"status":     "draft",
				},
			},
		},
		{
			name:        "meeting-notes.txt",
			content:     "Meeting notes from the quarterly planning session...",
			contentType: "text/plain",
			metadata: sdln.DocumentMetadata{
				Title:       "Q4 Planning Meeting Notes",
				Description: "Notes from quarterly planning and strategy session",
				Author:      "Project Manager",
				Language:    "en",
				Category:    "meeting",
				CustomFields: map[string]string{
					"date":      "2024-01-15",
					"attendees": "12",
					"duration":  "2h",
				},
			},
		},
	}

	fmt.Printf("Processing %d documents with streaming updates...\n\n", len(documents))

	// Process each document with streaming updates
	for i, doc := range documents {
		fmt.Printf("Processing document %d: %s\n", i+1, doc.name)

		// Simulate document upload with streaming progress
		err := processDocumentWithStreaming(ctx, client, tenantID, doc)
		if err != nil {
			fmt.Printf("  Error processing document: %v\n", err)
			continue
		}

		fmt.Printf("  Document processed successfully\n\n")
	}

	fmt.Printf("All documents processed\n")
	return nil
}

// processDocumentWithStreaming simulates processing a document with streaming updates
func processDocumentWithStreaming(ctx context.Context, client *sdln.Client, tenantID string, doc struct {
	name        string
	content     string
	contentType string
	metadata    sdln.DocumentMetadata
}) error {
	// Simulate upload phases
	phases := []struct {
		name        string
		duration    time.Duration
		progress    int
		description string
	}{
		{"Validating document", 500 * time.Millisecond, 10, "Checking file format and permissions"},
		{"Uploading content", 2 * time.Second, 30, "Transferring file to secure storage"},
		{"Extracting text", 1 * time.Second, 50, "OCR and text extraction"},
		{"Analyzing content", 1.5 * time.Second, 70, "Content analysis and classification"},
		{"Generating embeddings", 1 * time.Second, 85, "Creating vector embeddings"},
		{"Indexing for search", 800 * time.Millisecond, 95, "Adding to search index"},
		{"Finalizing", 500 * time.Millisecond, 100, "Completing processing"},
	}

	for _, phase := range phases {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		fmt.Printf("  [%s] %s (%d%%)\n", phase.name, phase.description, phase.progress)

		// Simulate work
		time.Sleep(phase.duration)
	}

	// Simulate extracting some metrics
	contentLength := len(doc.content)
	wordCount := len(strings.Fields(doc.content))

	fmt.Printf("  Processing complete:\n")
	fmt.Printf("    Content length: %d characters\n", contentLength)
	fmt.Printf("    Word count: %d\n", wordCount)
	fmt.Printf("    Language: %s\n", doc.metadata.Language)
	fmt.Printf("    Category: %s\n", doc.metadata.Category)

	return nil
}

// realTimeMetricsStreaming demonstrates real-time metrics streaming
func realTimeMetricsStreaming(client *sdln.Client, tenantID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	fmt.Printf("Starting real-time metrics streaming\n")

	// Set up signal handling for graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Metrics to stream
	metricTypes := []string{
		"api_requests_total",
		"response_time_seconds",
		"active_users",
		"document_processing_queue",
		"vector_search_latency",
		"cache_hit_rate",
		"error_rate",
		"throughput_mbps",
	}

	// Start metrics streaming goroutines
	var wg sync.WaitGroup
	stopChan := make(chan struct{})

	for i, metricType := range metricTypes {
		wg.Add(1)
		go func(index int, mType string) {
			defer wg.Done()
			streamMetrics(ctx, client, tenantID, mType, index, stopChan)
		}(i, metricType)
	}

	// Monitor for stop signal
	select {
	case <-sigChan:
		fmt.Printf("\nReceived interrupt signal, stopping metrics streaming\n")
	case <-ctx.Done():
		fmt.Printf("\nMetrics streaming completed due to timeout\n")
	}

	// Signal all goroutines to stop
	close(stopChan)

	// Wait for all goroutines to finish
	wg.Wait()

	fmt.Printf("All metrics streaming stopped\n")
	return nil
}

// streamMetrics streams metrics for a specific metric type
func streamMetrics(ctx context.Context, client *sdln.Client, tenantID, metricType string, index int, stopChan <-chan struct{}) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	var (
		totalSent    int
		lastValue    float64
		anomalyCount int
	)

	for {
		select {
		case <-ctx.Done():
			return
		case <-stopChan:
			fmt.Printf("Metrics stream %d (%s) stopped: sent %d metrics\n", index, metricType, totalSent)
			return
		case <-ticker.C:
			// Generate metric value based on type
			value := generateMetricValue(metricType, lastValue, &anomalyCount)

			// Create metric
			metric := sdln.Metric{
				Name:      metricType,
				Value:     value,
				Timestamp: sdln.NowTime(),
				Labels: map[string]string{
					"tenant_id": tenantID,
					"service":   getMetricService(metricType),
					"source":    "streaming-example",
				},
				Unit: getMetricUnit(metricType),
				Type: getMetricType(metricType),
			}

			// Send metric
			err := client.Monitoring.PushMetrics(ctx, tenantID, []sdln.Metric{metric})
			if err != nil {
				fmt.Printf("Error sending metric %s: %v\n", metricType, err)
			} else {
				totalSent++

				// Print metric update periodically
				if totalSent%5 == 0 || anomalyCount > 0 {
					fmt.Printf("[%s] %s: %.2f %s (total: %d)\n",
						time.Now().Format("15:04:05"),
						metricType, value, metric.Unit, totalSent)

					if anomalyCount > 0 {
						fmt.Printf("  ⚠️  Anomaly detected!\n")
					}
				}
			}

			lastValue = value
		}
	}
}

// generateMetricValue generates a realistic metric value
func generateMetricValue(metricType string, lastValue float64, anomalyCount *int) float64 {
	// Introduce occasional anomalies
	if time.Now().Unix()%20 == 0 && *anomalyCount < 3 {
		*anomalyCount++
		switch metricType {
		case "api_requests_total", "active_users":
			return lastValue * 0.1 // Sudden drop
		case "response_time_seconds", "vector_search_latency":
			return lastValue * 5.0 // Sudden spike
		case "error_rate":
			return min(0.5, lastValue*10.0) // High error rate
		default:
			return lastValue + (rand.Float64()-0.5)*2
		}
	}

	// Normal value generation based on metric type
	switch metricType {
	case "api_requests_total":
		// Gradually increasing counter
		return lastValue + 5 + rand.Float64()*10

	case "response_time_seconds", "vector_search_latency":
		// Normally distributed around a mean
		mean := 0.2
		if metricType == "vector_search_latency" {
			mean = 0.15
		}
		return max(0.01, mean+(rand.Float64()-0.5)*0.1)

	case "active_users":
		// Oscillating user count
		base := 50.0
		oscillation := math.Sin(time.Now().Unix()/10.0) * 20
		return max(10, base+oscillation+rand.Float64()*5)

	case "document_processing_queue":
		// Queue length with occasional bursts
		if rand.Float64() < 0.1 {
			return lastValue + rand.Float64()*20
		}
		return max(0, lastValue-2+rand.Float64()*3)

	case "cache_hit_rate":
		// Percentage with some variation
		return 0.85 + (rand.Float64()-0.5)*0.1

	case "error_rate":
		// Low error rate with occasional spikes
		if rand.Float64() < 0.05 {
			return rand.Float64() * 0.05 // 0-5% error rate
		}
		return rand.Float64() * 0.001 // 0-0.1% error rate

	case "throughput_mbps":
		// Network throughput
		return 100 + (rand.Float64()-0.5)*20

	default:
		// Generic metric
		return lastValue + (rand.Float64()-0.5)*2
	}
}

// getMetricService returns the service name for a metric type
func getMetricService(metricType string) string {
	switch {
	case strings.Contains(metricType, "api"):
		return "api-gateway"
	case strings.Contains(metricType, "vector"):
		return "vector-service"
	case strings.Contains(metricType, "cache"):
		return "cache-service"
	case strings.Contains(metricType, "document"):
		return "document-service"
	case strings.Contains(metricType, "user"):
		return "auth-service"
	default:
		return "system"
	}
}

// getMetricUnit returns the unit for a metric type
func getMetricUnit(metricType string) string {
	switch {
	case strings.Contains(metricType, "time") || strings.Contains(metricType, "latency"):
		return "seconds"
	case strings.Contains(metricType, "rate"):
		return "percent"
	case strings.Contains(metricType, "total") || strings.Contains(metricType, "users"):
		return "count"
	case strings.Contains(metricType, "throughput"):
		return "mbps"
	default:
		return "value"
	}
}

// getMetricType returns the type for a metric
func getMetricType(metricType string) string {
	switch {
	case strings.Contains(metricType, "total") || strings.Contains(metricType, "users"):
		return "counter"
	case strings.Contains(metricType, "time") || strings.Contains(metricType, "latency"):
		return "histogram"
	case strings.Contains(metricType, "rate") || strings.Contains(metricType, "queue"):
		return "gauge"
	default:
		return "counter"
	}
}

// Helper functions
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

func randFloat64() float64 {
	return float64(time.Now().UnixNano()%1000) / 1000.0
}
