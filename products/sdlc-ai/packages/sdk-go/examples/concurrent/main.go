package main

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/SDLC/sdln-sdk-go/pkg/auth"
	"github.com/SDLC/sdln-sdk-go/pkg/sdln"
)

func main() {
	fmt.Println("=== SDLC.ai Go SDK - Concurrent Operations Example ===")

	// Configure client for high-performance operations
	config := &sdln.Config{
		BaseURL:             "https://api.sdlc.ai",
		Timeout:             60 * time.Second,
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 20,
		IdleConnTimeout:     90 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
		RetryConfig: &sdln.RetryConfig{
			MaxRetries:      5,
			InitialBackoff:  50 * time.Millisecond,
			MaxBackoff:      10 * time.Second,
			BackoffFactor:   2.0,
			RetryableErrors: []string{"timeout", "connection_error", "rate_limit"},
			Jitter:          true,
		},
		Debug: false,
	}

	client, err := sdln.NewClient(
		config,
		auth.WithAPIKey("your-api-key-here"),
	)
	if err != nil {
		log.Fatalf("Failed to create client: %v", err)
	}
	defer client.Close()

	// Example 1: Concurrent user operations
	fmt.Println("\n--- Concurrent User Operations ---")
	err = concurrentUserOperations(client, 10, 50)
	if err != nil {
		log.Printf("Concurrent user operations failed: %v", err)
	}

	// Example 2: Concurrent document processing
	fmt.Println("\n--- Concurrent Document Processing ---")
	err = concurrentDocumentProcessing(client, 5, 20)
	if err != nil {
		log.Printf("Concurrent document processing failed: %v", err)
	}

	// Example 3: Concurrent RAG queries
	fmt.Println("\n--- Concurrent RAG Queries ---")
	err = concurrentRAGQueries(client, 3, 15)
	if err != nil {
		log.Printf("Concurrent RAG queries failed: %v", err)
	}

	// Example 4: Concurrent vector operations
	fmt.Println("\n--- Concurrent Vector Operations ---")
	err = concurrentVectorOperations(client, 3, 30)
	if err != nil {
		log.Printf("Concurrent vector operations failed: %v", err)
	}

	// Example 5: Bulk operations with workers
	fmt.Println("\n--- Bulk Operations with Worker Pool ---")
	err = bulkOperationsWithWorkers(client, 8, 100)
	if err != nil {
		log.Printf("Bulk operations failed: %v", err)
	}

	// Example 6: Rate-limited operations
	fmt.Println("\n--- Rate-Limited Operations ---")
	err = rateLimitedOperations(client, 5, 100)
	if err != nil {
		log.Printf("Rate-limited operations failed: %v", err)
	}

	// Example 7: Parallel policy evaluation
	fmt.Println("\n--- Parallel Policy Evaluation ---")
	err = parallelPolicyEvaluation(client, 4, 25)
	if err != nil {
		log.Printf("Parallel policy evaluation failed: %v", err)
	}

	// Example 8: Concurrent metrics collection
	fmt.Println("\n--- Concurrent Metrics Collection ---")
	err = concurrentMetricsCollection(client, 6, 40)
	if err != nil {
		log.Printf("Concurrent metrics collection failed: %v", err)
	}

	fmt.Println("\n=== Concurrent Operations Example Complete ===")
}

// concurrentUserOperations performs concurrent user CRUD operations
func concurrentUserOperations(client *sdln.Client, numWorkers, numOperations int) error {
	ctx := context.Background()

	// First, create a tenant for our operations
	tenant, err := client.Tenants.Create(ctx, &sdln.CreateTenantRequest{
		Name: "Concurrent Operations Tenant",
		Settings: sdln.TenantSettings{
			MaxUsers:        1000,
			MaxDocuments:    10000,
			MaxStorage:      51200, // 50GB
			AllowSSO:        false,
			RequireMFA:      false,
			DataRetention:   90,
			EnableAudit:     true,
			EncryptionLevel: "standard",
		},
	})
	if err != nil {
		return fmt.Errorf("failed to create tenant: %w", err)
	}

	var wg sync.WaitGroup
	semaphore := make(chan struct{}, numWorkers) // Limit concurrent operations
	errors := make(chan error, numOperations)
	start := time.Now()

	// Generate user operations
	operations := generateUserOperations(tenant.ID, numOperations)

	for i, op := range operations {
		wg.Add(1)
		go func(index int, operation userOperation) {
			defer wg.Done()
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			err := executeUserOperation(ctx, client, operation)
			if err != nil {
				errors <- fmt.Errorf("operation %d failed: %w", index, err)
			}
		}(i, op)
	}

	wg.Wait()
	close(errors)

	duration := time.Since(start)

	// Collect errors
	var errorCount int
	for err := range errors {
		errorCount++
		log.Printf("Error: %v", err)
	}

	successCount := numOperations - errorCount
	fmt.Printf("Completed %d/%d user operations in %v (%.2f ops/sec)\n",
		successCount, numOperations, duration, float64(successCount)/duration.Seconds())

	if errorCount > 0 {
		return fmt.Errorf("%d operations failed", errorCount)
	}

	return nil
}

// userOperation represents a user CRUD operation
type userOperation struct {
	Type     string      // "create", "update", "get", "delete"
	UserID   string      // for update, get, delete
	UserData interface{} // user data for create/update
}

// generateUserOperations generates a list of user operations
func generateUserOperations(tenantID string, count int) []userOperation {
	operations := make([]userOperation, count)

	for i := 0; i < count; i++ {
		opType := []string{"create", "update", "get"}[i%3] // Don't delete in this example

		operations[i] = userOperation{
			Type: opType,
			UserData: &sdln.CreateUserRequest{
				Email:     fmt.Sprintf("user%d@example.com", i),
				FirstName: fmt.Sprintf("User%d", i),
				LastName:  "Test",
				Role:      "user",
				TenantID:  tenantID,
				IsActive:  true,
			},
		}
	}

	return operations
}

// executeUserOperation executes a single user operation
func executeUserOperation(ctx context.Context, client *sdln.Client, op userOperation) error {
	switch op.Type {
	case "create":
		if userData, ok := op.UserData.(*sdln.CreateUserRequest); ok {
			_, err := client.Users.Create(ctx, userData)
			return err
		}
	case "update":
		if op.UserID != "" {
			_, err := client.Users.Update(ctx, op.UserID, &sdln.UpdateUserRequest{
				FirstName: &[]string{"Updated"}[0],
			})
			return err
		}
	case "get":
		if op.UserID != "" {
			_, err := client.Users.Get(ctx, op.UserID)
			return err
		}
	}

	return fmt.Errorf("unknown operation type: %s", op.Type)
}

// concurrentDocumentProcessing processes documents concurrently
func concurrentDocumentProcessing(client *sdln.Client, numWorkers, numDocuments int) error {
	ctx := context.Background()

	// Create tenant
	tenant, err := client.Tenants.Create(ctx, &sdln.CreateTenantRequest{
		Name: "Document Processing Tenant",
		Settings: sdln.TenantSettings{
			MaxDocuments: 1000,
			MaxStorage:   102400, // 100GB
		},
	})
	if err != nil {
		return err
	}

	var wg sync.WaitGroup
	semaphore := make(chan struct{}, numWorkers)
	documents := make(chan *sdln.Document, numDocuments)
	errors := make(chan error, numDocuments)
	start := time.Now()

	// Start document processing workers
	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for doc := range documents {
				semaphore <- struct{}{}
				defer func() { <-semaphore }()

				err := processDocument(ctx, client, doc)
				if err != nil {
					errors <- fmt.Errorf("worker %d failed to process document %s: %w", workerID, doc.ID, err)
				}
			}
		}(i)
	}

	// Generate and queue documents
	for i := 0; i < numDocuments; i++ {
		doc := &sdln.Document{
			ID:          fmt.Sprintf("doc-%d", i),
			TenantID:    tenant.ID,
			Filename:    fmt.Sprintf("document_%d.txt", i),
			ContentType: "text/plain",
			Size:        int64(1024 + i*100), // Variable sizes
			Metadata: sdln.DocumentMetadata{
				Title:       fmt.Sprintf("Document %d", i),
				Description: fmt.Sprintf("This is test document number %d", i),
				Author:      fmt.Sprintf("Author %d", i%5),
				Language:    "en",
				Category:    []string{"test", "sample"}[i%2 : i%2+1 : i%2],
			},
		}
		documents <- doc
	}

	close(documents)
	wg.Wait()
	close(errors)

	duration := time.Since(start)

	// Count errors
	errorCount := 0
	for err := range errors {
		errorCount++
		log.Printf("Document processing error: %v", err)
	}

	successCount := numDocuments - errorCount
	fmt.Printf("Processed %d/%d documents in %v (%.2f docs/sec)\n",
		successCount, numDocuments, duration, float64(successCount)/duration.Seconds())

	return nil
}

// processDocument simulates document processing
func processDocument(ctx context.Context, client *sdln.Client, doc *sdln.Document) error {
	// Simulate processing time
	time.Sleep(time.Duration(50+doc.Size/20) * time.Millisecond)

	// In a real implementation, you might:
	// - Extract content
	// - Generate embeddings
	// - Index for search
	// - Apply policies

	return nil
}

// concurrentRAGQueries performs concurrent RAG queries
func concurrentRAGQueries(client *sdln.Client, numWorkers, numQueries int) error {
	ctx := context.Background()

	// Create tenant and some sample data
	tenant, err := setupRAGEnvironment(ctx, client)
	if err != nil {
		return err
	}

	var wg sync.WaitGroup
	semaphore := make(chan struct{}, numWorkers)
	queries := generateRAGQueries(numQueries)
	responses := make(chan *sdln.RAGResponse, numQueries)
	errors := make(chan error, numQueries)
	start := time.Now()

	for i, query := range queries {
		wg.Add(1)
		go func(index int, q string) {
			defer wg.Done()
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			response, err := client.RAG.Query(ctx, &sdln.QueryRequest{
				Query:    q,
				TenantID: tenant.ID,
				ContextOptions: &sdln.ContextOptions{
					MaxContextLength: 2000,
					MaxChunks:        3,
					MinSimilarity:    0.7,
					Strategy:         "hybrid",
				},
				GenerationOptions: &sdln.GenerationOptions{
					Model:       "gpt-3.5-turbo",
					MaxTokens:   200,
					Temperature: &[]float64{0.5}[0],
				},
			})

			if err != nil {
				errors <- fmt.Errorf("query %d failed: %w", index, err)
			} else {
				responses <- response
			}
		}(i, query)
	}

	wg.Wait()
	close(responses)
	close(errors)

	duration := time.Since(start)

	// Analyze results
	responseCount := 0
	var totalConfidence float64
	for resp := range responses {
		responseCount++
		totalConfidence += resp.Confidence
	}

	errorCount := 0
	for err := range errors {
		errorCount++
		log.Printf("RAG query error: %v", err)
	}

	avgConfidence := float64(0)
	if responseCount > 0 {
		avgConfidence = totalConfidence / float64(responseCount)
	}

	fmt.Printf("Completed %d/%d RAG queries in %v (%.2f queries/sec, avg confidence: %.2f)\n",
		responseCount, numQueries, duration, float64(responseCount)/duration.Seconds(), avgConfidence)

	return nil
}

// setupRAGEnvironment creates a tenant and sample data for RAG queries
func setupRAGEnvironment(ctx context.Context, client *sdln.Client) (*sdln.Tenant, error) {
	tenant, err := client.Tenants.Create(ctx, &sdln.CreateTenantRequest{
		Name: "RAG Query Tenant",
		Settings: sdln.TenantSettings{
			MaxDocuments: 500,
			MaxStorage:   51200, // 50GB
		},
	})
	if err != nil {
		return nil, err
	}

	// In a real implementation, you would:
	// - Upload sample documents
	// - Process and extract content
	// - Create vector embeddings
	// - Set up the RAG system

	return tenant, nil
}

// generateRAGQueries generates sample RAG queries
func generateRAGQueries(count int) []string {
	queries := make([]string, count)
	queryTemplates := []string{
		"What is the main topic of document %d?",
		"Summarize the key findings in chapter %d.",
		"Explain the concept mentioned in section %d.",
		"What are the recommendations from page %d?",
		"Compare the approaches described in document %d.",
		"Identify the main stakeholders mentioned in %d.",
		"What are the risks associated with %d?",
		"Provide a timeline for the events in %d.",
		"Explain the methodology used in %d.",
		"What are the conclusions from %d?",
	}

	for i := 0; i < count; i++ {
		queries[i] = fmt.Sprintf(queryTemplates[i%len(queryTemplates)], i+1)
	}

	return queries
}

// concurrentVectorOperations performs concurrent vector database operations
func concurrentVectorOperations(client *sdln.Client, numWorkers, numOperations int) error {
	ctx := context.Background()

	// Create tenant and namespace
	tenant, err := client.Tenants.Create(ctx, &sdln.CreateTenantRequest{
		Name: "Vector Operations Tenant",
	})
	if err != nil {
		return err
	}

	namespace := fmt.Sprintf("test-namespace-%d", time.Now().Unix())

	var wg sync.WaitGroup
	semaphore := make(chan struct{}, numWorkers)
	operations := generateVectorOperations(tenant.ID, namespace, numOperations)
	results := make(chan string, numOperations)
	errors := make(chan error, numOperations)
	start := time.Now()

	for i, op := range operations {
		wg.Add(1)
		go func(index int, operation vectorOperation) {
			defer wg.Done()
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			result, err := executeVectorOperation(ctx, client, operation)
			if err != nil {
				errors <- fmt.Errorf("operation %d failed: %w", index, err)
			} else {
				results <- result
			}
		}(i, op)
	}

	wg.Wait()
	close(results)
	close(errors)

	duration := time.Since(start)

	// Count results
	resultCount := 0
	for range results {
		resultCount++
	}

	errorCount := 0
	for err := range errors {
		errorCount++
		log.Printf("Vector operation error: %v", err)
	}

	fmt.Printf("Completed %d/%d vector operations in %v (%.2f ops/sec)\n",
		resultCount, numOperations, duration, float64(resultCount)/duration.Seconds())

	return nil
}

// vectorOperation represents a vector database operation
type vectorOperation struct {
	Type      string
	TenantID  string
	Namespace string
	Data      interface{}
}

// generateVectorOperations generates vector operations
func generateVectorOperations(tenantID, namespace string, count int) []vectorOperation {
	operations := make([]vectorOperation, count)

	for i := 0; i < count; i++ {
		opType := []string{"create", "search", "delete"}[i%3]

		var data interface{}
		switch opType {
		case "create":
			data = &sdln.VectorCreateRequest{
				TenantID:  tenantID,
				Namespace: namespace,
				Vectors: []sdln.VectorInput{
					{
						ID:     fmt.Sprintf("vector-%d", i),
						Values: generateRandomVector(128),
						Metadata: map[string]interface{}{
							"source": fmt.Sprintf("document-%d", i),
							"type":   "test",
						},
					},
				},
			}
		case "search":
			data = &sdln.SearchRequest{
				TenantID:  tenantID,
				Namespace: namespace,
				Vector:    generateRandomVector(128),
				TopK:      10,
			}
		case "delete":
			data = []string{fmt.Sprintf("vector-%d", i)}
		}

		operations[i] = vectorOperation{
			Type:      opType,
			TenantID:  tenantID,
			Namespace: namespace,
			Data:      data,
		}
	}

	return operations
}

// generateRandomVector generates a random vector of specified dimension
func generateRandomVector(dim int) []float64 {
	vector := make([]float64, dim)
	for i := 0; i < dim; i++ {
		// Generate random values between -1 and 1
		vector[i] = float64(i%100)/50.0 - 1.0
	}
	return vector
}

// executeVectorOperation executes a single vector operation
func executeVectorOperation(ctx context.Context, client *sdln.Client, op vectorOperation) (string, error) {
	switch op.Type {
	case "create":
		if req, ok := op.Data.(*sdln.VectorCreateRequest); ok {
			result, err := client.Vector.Create(ctx, req)
			if err != nil {
				return "", err
			}
			return fmt.Sprintf("created %d vectors", len(result.CreatedIDs)), nil
		}
	case "search":
		if req, ok := op.Data.(*sdln.SearchRequest); ok {
			result, err := client.Vector.Search(ctx, req)
			if err != nil {
				return "", err
			}
			return fmt.Sprintf("found %d results", len(result.Results)), nil
		}
	case "delete":
		if ids, ok := op.Data.([]string); ok {
			result, err := client.Vector.Delete(ctx, op.TenantID, op.Namespace, ids)
			if err != nil {
				return "", err
			}
			return fmt.Sprintf("deleted %d vectors", len(result.DeletedIDs)), nil
		}
	}

	return "", fmt.Errorf("unknown operation type: %s", op.Type)
}

// bulkOperationsWithWorkers demonstrates bulk operations with a worker pool
func bulkOperationsWithWorkers(client *sdln.Client, numWorkers, numItems int) error {
	ctx := context.Background()

	// Create tenant
	tenant, err := client.Tenants.Create(ctx, &sdln.CreateTenantRequest{
		Name: "Bulk Operations Tenant",
		Settings: sdln.TenantSettings{
			MaxUsers: numItems,
		},
	})
	if err != nil {
		return err
	}

	// Prepare bulk user creation data
	users := make([]*sdln.CreateUserRequest, numItems)
	for i := 0; i < numItems; i++ {
		users[i] = &sdln.CreateUserRequest{
			Email:     fmt.Sprintf("bulk-user-%d@example.com", i),
			FirstName: fmt.Sprintf("BulkUser%d", i),
			LastName:  "Test",
			Role:      "user",
			TenantID:  tenant.ID,
			IsActive:  true,
		}
	}

	start := time.Now()

	// Perform bulk operation
	result, err := client.Users.BulkCreate(ctx, users)
	if err != nil {
		return err
	}

	duration := time.Since(start)

	fmt.Printf("Bulk created %d users in %v (%.2f users/sec, %d failed)\n",
		len(result.Success), duration, float64(len(result.Success))/duration.Seconds(), len(result.Failed))

	// Process successful users with workers
	var wg sync.WaitGroup
	semaphore := make(chan struct{}, numWorkers)
	processed := make(chan int, len(result.Success))

	for i, user := range result.Success {
		wg.Add(1)
		go func(index int, u sdln.User) {
			defer wg.Done()
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			// Simulate processing each user
			time.Sleep(10 * time.Millisecond)

			// In a real implementation, you might:
			// - Send welcome emails
			// - Set up default permissions
			// - Initialize user preferences

			processed <- index
		}(i, user)
	}

	wg.Wait()
	close(processed)

	processedCount := 0
	for range processed {
		processedCount++
	}

	fmt.Printf("Processed %d users with %d workers\n", processedCount, numWorkers)

	return nil
}

// rateLimitedOperations demonstrates rate-limited concurrent operations
func rateLimitedOperations(client *sdln.Client, maxConcurrent, numOperations int) error {
	ctx := context.Background()

	// Create tenant
	tenant, err := client.Tenants.Create(ctx, &sdln.CreateTenantRequest{
		Name: "Rate Limited Operations Tenant",
	})
	if err != nil {
		return err
	}

	var wg sync.WaitGroup
	semaphore := make(chan struct{}, maxConcurrent)
	operations := make(chan int, numOperations)
	completed := make(chan int, numOperations)
	errors := make(chan error, numOperations)
	start := time.Now()

	// Start workers
	for i := 0; i < maxConcurrent; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for opID := range operations {
				err := performRateLimitedOperation(ctx, client, tenant.ID, opID)
				if err != nil {
					errors <- fmt.Errorf("worker %d, operation %d failed: %w", workerID, opID, err)
				} else {
					completed <- opID
				}

				// Simulate rate limiting delay
				time.Sleep(100 * time.Millisecond)
			}
		}(i)
	}

	// Queue operations
	for i := 0; i < numOperations; i++ {
		operations <- i
	}
	close(operations)

	wg.Wait()
	close(completed)
	close(errors)

	duration := time.Since(start)

	completedCount := 0
	for range completed {
		completedCount++
	}

	errorCount := 0
	for err := range errors {
		errorCount++
		log.Printf("Rate limited operation error: %v", err)
	}

	fmt.Printf("Completed %d/%d rate-limited operations in %v (%.2f ops/sec, max concurrent: %d)\n",
		completedCount, numOperations, duration, float64(completedCount)/duration.Seconds(), maxConcurrent)

	return nil
}

// performRateLimitedOperation performs a single operation with rate limiting
func performRateLimitedOperation(ctx context.Context, client *sdln.Client, tenantID string, opID int) error {
	// Simulate different operation types
	switch opID % 4 {
	case 0:
		_, err := client.Tenants.GetUsage(ctx, tenantID)
		return err
	case 1:
		_, err := client.Users.List(ctx, &sdln.ListOptions{Page: 1, PageSize: 10})
		return err
	case 2:
		_, err := client.Monitoring.GetHealth(ctx, tenantID, []string{})
		return err
	case 3:
		// Simulate a simple API call
		time.Sleep(50 * time.Millisecond)
		return nil
	}

	return nil
}

// parallelPolicyEvaluation demonstrates parallel policy evaluation
func parallelPolicyEvaluation(client *sdln.Client, numWorkers, numEvaluations int) error {
	ctx := context.Background()

	// Create tenant and policy
	tenant, err := client.Tenants.Create(ctx, &sdln.CreateTenantRequest{
		Name: "Policy Evaluation Tenant",
	})
	if err != nil {
		return err
	}

	policy, err := client.Policies.Create(ctx, &sdln.CreatePolicyRequest{
		Name: "Test Policy",
		Type: "access",
		Rules: []sdln.PolicyRule{
			{
				ID:       "test-rule",
				Name:     "Test Rule",
				Type:     "attribute",
				Operator: "equals",
				Field:    "user.role",
				Value:    "user",
			},
		},
		Effect: "allow",
	})
	if err != nil {
		return err
	}

	var wg sync.WaitGroup
	semaphore := make(chan struct{}, numWorkers)
	evaluations := generatePolicyEvaluations(tenant.ID, policy.ID, numEvaluations)
	results := make(chan *sdln.PolicyEvaluationResult, numEvaluations)
	errors := make(chan error, numEvaluations)
	start := time.Now()

	for i, eval := range evaluations {
		wg.Add(1)
		go func(index int, evaluation sdln.PolicyEvaluationRequest) {
			defer wg.Done()
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			result, err := client.Policies.Evaluate(ctx, &evaluation)
			if err != nil {
				errors <- fmt.Errorf("evaluation %d failed: %w", index, err)
			} else {
				results <- result
			}
		}(i, eval)
	}

	wg.Wait()
	close(results)
	close(errors)

	duration := time.Since(start)

	// Analyze results
	resultCount := 0
	allowedCount := 0
	for result := range results {
		resultCount++
		if result.Allowed {
			allowedCount++
		}
	}

	errorCount := 0
	for err := range errors {
		errorCount++
		log.Printf("Policy evaluation error: %v", err)
	}

	fmt.Printf("Completed %d/%d policy evaluations in %v (%.2f evals/sec, %d allowed)\n",
		resultCount, numEvaluations, duration, float64(resultCount)/duration.Seconds(), allowedCount)

	return nil
}

// generatePolicyEvaluations generates policy evaluation requests
func generatePolicyEvaluations(tenantID, policyID string, count int) []sdln.PolicyEvaluationRequest {
	evaluations := make([]sdln.PolicyEvaluationRequest, count)

	for i := 0; i < count; i++ {
		evaluations[i] = sdln.PolicyEvaluationRequest{
			TenantID: tenantID,
			UserID:   fmt.Sprintf("user-%d", i),
			Resource: fmt.Sprintf("resource-%d", i),
			Action:   []string{"read", "write", "delete"}[i%3],
			Context: map[string]interface{}{
				"hour":       10 + (i % 8),
				"ip_address": fmt.Sprintf("192.168.1.%d", 100+(i%50)),
			},
			Attributes: map[string]interface{}{
				"user": map[string]interface{}{
					"role":       []string{"admin", "user", "guest"}[i%3],
					"department": []string{"engineering", "sales", "marketing"}[i%3],
				},
				"resource": map[string]interface{}{
					"classification": []string{"public", "internal", "confidential"}[i%3],
					"owner":          fmt.Sprintf("owner-%d@example.com", i%5),
				},
			},
		}
	}

	return evaluations
}

// concurrentMetricsCollection demonstrates concurrent metrics collection
func concurrentMetricsCollection(client *sdln.Client, numWorkers, numMetrics int) error {
	ctx := context.Background()

	// Create tenant
	tenant, err := client.Tenants.Create(ctx, &sdln.CreateTenantRequest{
		Name: "Metrics Collection Tenant",
	})
	if err != nil {
		return err
	}

	var wg sync.WaitGroup
	semaphore := make(chan struct{}, numWorkers)
	metrics := generateMetrics(tenant.ID, numMetrics)
	completed := make(chan int, numMetrics)
	errors := make(chan error, numMetrics)
	start := time.Now()

	for i, metric := range metrics {
		wg.Add(1)
		go func(index int, m sdln.Metric) {
			defer wg.Done()
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			err := client.Monitoring.PushMetrics(ctx, m.TenantID, []sdln.Metric{m})
			if err != nil {
				errors <- fmt.Errorf("metric %d failed: %w", index, err)
			} else {
				completed <- index
			}
		}(i, metric)
	}

	wg.Wait()
	close(completed)
	close(errors)

	duration := time.Since(start)

	completedCount := 0
	for range completed {
		completedCount++
	}

	errorCount := 0
	for err := range errors {
		errorCount++
		log.Printf("Metrics collection error: %v", err)
	}

	fmt.Printf("Collected %d/%d metrics in %v (%.2f metrics/sec)\n",
		completedCount, numMetrics, duration, float64(completedCount)/duration.Seconds())

	return nil
}

// generateMetrics generates sample metrics
func generateMetrics(tenantID string, count int) []sdln.Metric {
	metrics := make([]sdln.Metric, count)

	metricTypes := []string{
		"api_requests_total",
		"response_time_seconds",
		"error_rate",
		"active_users",
		"document_processing_time",
		"vector_search_latency",
		"policy_evaluation_time",
		"cache_hit_rate",
	}

	for i := 0; i < count; i++ {
		metricType := metricTypes[i%len(metricTypes)]

		var value float64
		switch metricType {
		case "api_requests_total", "active_users":
			value = float64(1 + i%100)
		case "response_time_seconds", "document_processing_time", "vector_search_latency", "policy_evaluation_time":
			value = 0.1 + float64(i%50)*0.01
		case "error_rate", "cache_hit_rate":
			value = float64(i%100) / 100.0
		}

		metrics[i] = sdln.Metric{
			Name:      metricType,
			Value:     value,
			Timestamp: sdln.NowTime(),
			Labels: map[string]string{
				"tenant_id": tenantID,
				"service":   []string{"api", "rag", "vector", "auth"}[i%4],
				"method":    []string{"GET", "POST", "PUT", "DELETE"}[i%4],
				"status":    fmt.Sprintf("%d", 200+(i%4)*100),
			},
			Unit: getUnitForMetric(metricType),
			Type: getTypeForMetric(metricType),
		}
	}

	return metrics
}

// getUnitForMetric returns the appropriate unit for a metric type
func getUnitForMetric(metricType string) string {
	switch {
	case strings.Contains(metricType, "time") || strings.Contains(metricType, "latency"):
		return "seconds"
	case strings.Contains(metricType, "rate") || strings.Contains(metricType, "hit"):
		return "percent"
	case strings.Contains(metricType, "users") || strings.Contains(metricType, "requests"):
		return "count"
	default:
		return "value"
	}
}

// getTypeForMetric returns the appropriate type for a metric
func getTypeForMetric(metricType string) string {
	switch {
	case strings.Contains(metricType, "total") || strings.Contains(metricType, "users"):
		return "counter"
	case strings.Contains(metricType, "time") || strings.Contains(metricType, "latency"):
		return "histogram"
	case strings.Contains(metricType, "rate"):
		return "gauge"
	default:
		return "counter"
	}
}
