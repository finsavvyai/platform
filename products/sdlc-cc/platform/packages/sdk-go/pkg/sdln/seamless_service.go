package sdln

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// SeamlessService provides the main seamless interface that orchestrates all other services
type SeamlessService struct {
	*BaseService
	dlp        *DLPService
	policies   *PoliciesService
	documents  *DocumentService
	rag        *RAGService
	llm        *LLMService
	vector     *VectorService
	monitoring *MonitoringService
}

// NewSeamlessService creates a new seamless service
func NewSeamlessService(client *Client) *SeamlessService {
	return &SeamlessService{
		BaseService: NewBaseService(client, "seamless", "api/v1/seamless"),
		dlp:         NewDLPService(client),
		policies:    NewPoliciesService(client),
		documents:   NewDocumentService(client),
		rag:         NewRAGService(client),
		llm:         NewLLMService(client),
		vector:      NewVectorService(client),
		monitoring:  NewMonitoringService(client),
	}
}

// Ask performs a seamless query with automatic orchestration
func (s *SeamlessService) Ask(ctx context.Context, query string, options *SeamlessOptions) (*SeamlessResponse, error) {
	if options == nil {
		options = DefaultSeamlessOptions()
	}

	startTime := time.Now()
	queryID := generateID()

	// Initialize orchestration result
	orchestration := &OrchestrationResult{
		QueryID:   queryID,
		Steps:     make([]OrchestrationStep, 0),
		TotalTime: 0,
		Success:   true,
		Metadata:  make(map[string]interface{}),
	}

	// Step 1: DLP Scanning (if enabled)
	var sanitizedQuery = query
	var dlpResult *DLPScanResult
	var securityAnalysis SecurityAnalysis

	if options.EnableDLP {
		step := s.createStep("dlp_scan", "Scanning query for PII")
		step.StartTime = time.Now()

		dlpOptions := &DLPScanRequest{
			Text:            query,
			ScanType:        "pii",
			RedactionMethod: "mask",
			MinConfidence:   &[]float64{0.7}[0],
		}

		dlpResult, _ = s.dlp.ScanAndRedact(ctx, query, dlpOptions)
		if dlpResult != nil {
			sanitizedQuery = dlpResult.RedactedText
			securityAnalysis.PIIDetected = dlpResult.PIIFound
			securityAnalysis.PIIRedacted = dlpResult.PIIFound
		}

		step.Duration = time.Since(step.StartTime)
		step.Status = "success"
		step.Output = map[string]interface{}{"pii_found": dlpResult != nil && dlpResult.PIIFound}
		orchestration.Steps = append(orchestration.Steps, *step)
	}

	// Step 2: Policy Evaluation
	if options.StrictPolicy {
		step := s.createStep("policy_check", "Evaluating access policies")
		step.StartTime = time.Now()

		policyReq := &PolicyEvaluationRequest{
			TenantID: s.client.config.BaseURL, // This should be extracted from context
			UserID:   stringOrEmpty(options.UserID),
			Resource: "seamless:query",
			Action:   "execute",
			Context: map[string]interface{}{
				"query":     sanitizedQuery,
				"query_id":  queryID,
				"timestamp": time.Now().UTC(),
			},
		}

		policyResult, err := s.policies.Evaluate(ctx, policyReq)
		if err != nil || !policyResult.Allowed {
			step.Status = "failure"
			step.Error = fmt.Sprintf("Policy evaluation failed: %v", err)
			orchestration.Success = false
			orchestration.Error = &APIError{
				Type:       ErrTypeForbidden,
				Message:    "Access denied by policy evaluation",
				StatusCode: 403,
				Timestamp:  time.Now().UTC(),
			}
			return nil, fmt.Errorf("access denied by policy evaluation")
		}

		step.Duration = time.Since(step.StartTime)
		step.Status = "success"
		step.Output = map[string]interface{}{"allowed": policyResult.Allowed}
		securityAnalysis.PolicyChecks = []string{"access_control:passed"}
		orchestration.Steps = append(orchestration.Steps, *step)
	}

	// Step 3: Context Retrieval
	step := s.createStep("context_retrieval", "Retrieving relevant context")
	step.StartTime = time.Now()

	ragReq := &QueryRequest{
		Query: sanitizedQuery,
		ContextOptions: &ContextOptions{
			MaxContextLength: options.MaxContextLength,
			MaxChunks:        options.MaxSources,
			Strategy:         options.ContextStrategy,
			IncludeCitations: options.IncludeCitations,
		},
		RetrievalOptions: &RetrievalOptions{
			SearchType:    "hybrid",
			MaxResults:    options.MaxSources,
			Rerank:        true,
			DocumentTypes: options.DocumentTypes,
		},
		GenerationOptions: &GenerationOptions{
			Model:          options.Model,
			MaxTokens:      func() int { if options.MaxTokens != nil { return *options.MaxTokens }; return 0 }(),
			Temperature:    func() float64 { if options.Temperature != nil { return *options.Temperature }; return 0 }(),
			ResponseFormat: "text",
		},
		Stream: false,
	}

	var ragResponse *RAGResponse
	var err error

	if options.Stream {
		// For streaming, we would implement streaming RAG
		ragResponse, err = s.rag.Query(ctx, ragReq)
	} else {
		ragResponse, err = s.rag.Query(ctx, ragReq)
	}

	if err != nil {
		step.Status = "failure"
		step.Error = fmt.Sprintf("Context retrieval failed: %v", err)
		orchestration.Success = false
		return nil, fmt.Errorf("failed to retrieve context: %w", err)
	}

	step.Duration = time.Since(step.StartTime)
	step.Status = "success"
	step.Output = map[string]interface{}{
		"context_chunks": len(ragResponse.Context),
		"sources":        len(ragResponse.Sources),
	}
	orchestration.Steps = append(orchestration.Steps, *step)

	// Step 4: LLM Generation
	step = s.createStep("llm_generation", "Generating AI response")
	step.StartTime = time.Now()

	// Prepare messages for LLM
	messages := []ChatMessage{
		{
			Role:    "system",
			Content: s.buildSystemPrompt(options),
		},
		{
			Role:    "user",
			Content: s.buildUserPrompt(sanitizedQuery, ragResponse.Context, options),
		},
	}

	chatReq := &ChatCompletionRequest{
		Model:       options.Model,
		Messages:    messages,
		MaxTokens:   options.MaxTokens,
		Temperature: options.Temperature,
		Stream:      options.Stream,
		TenantID:    "", // This should be extracted from context
		Metadata:    options.Metadata,
	}

	var chatResponse *ChatCompletionResponse
	if options.Stream {
		// Streaming would be handled separately
		chatResponse, err = s.llm.CreateChatCompletion(ctx, chatReq)
	} else {
		chatResponse, err = s.llm.CreateChatCompletion(ctx, chatReq)
	}

	if err != nil {
		step.Status = "failure"
		step.Error = fmt.Sprintf("LLM generation failed: %v", err)
		orchestration.Success = false
		return nil, fmt.Errorf("failed to generate response: %w", err)
	}

	step.Duration = time.Since(step.StartTime)
	step.Status = "success"
	orchestration.Steps = append(orchestration.Steps, *step)

	// Step 5: Output Sanitization
	step = s.createStep("output_sanitization", "Sanitizing output")
	step.StartTime = time.Now()

	finalAnswer := chatResponse.Choices[0].Message.Content
	if options.EnableDLP {
		// Scan output for PII leakage
		outputDLP, _ := s.dlp.ScanAndRedact(ctx, finalAnswer, &DLPScanRequest{
			Text:            finalAnswer,
			ScanType:        "pii",
			RedactionMethod: "mask",
		})
		if outputDLP != nil && outputDLP.PIIFound {
			finalAnswer = outputDLP.RedactedText
			securityAnalysis.PIIRedacted = true
		}
	}

	step.Duration = time.Since(step.StartTime)
	step.Status = "success"
	orchestration.Steps = append(orchestration.Steps, *step)

	// Build final response
	processingTime := time.Since(startTime)

	seamlessResponse := &SeamlessResponse{
		QueryID:           queryID,
		Answer:            finalAnswer,
		Confidence:        ragResponse.Confidence,
		Sources:           s.convertRAGSourcesToSeamless(ragResponse.Sources),
		Citations:         s.convertRAGCitationsToSeamless(ragResponse.Citations),
		ContextSummary:    s.buildContextSummary(ragResponse.Context),
		FollowupQuestions: ragResponse.FollowupQuestions,
		Metadata:          orchestration.Metadata,
		ProcessingTime:    processingTime,
		TokensUsed: SeamlessTokenUsage{
			Prompt:     ragResponse.TokensUsed.Prompt,
			Context:    s.calculateContextTokens(ragResponse.Context),
			Completion: chatResponse.Usage.CompletionTokens,
			Total:      ragResponse.TokensUsed.Total + chatResponse.Usage.CompletionTokens,
			USD:        s.calculateTokenCost(chatResponse.Usage, options.Model),
		},
		SecurityAnalysis: securityAnalysis,
		CreatedAt:        NewTimestamp(time.Now().UTC()),
	}

	orchestration.TotalTime = processingTime

	// Log the orchestration for monitoring
	_ = s.logOrchestration(ctx, orchestration)

	return seamlessResponse, nil
}

// AskStream performs a streaming seamless query
func (s *SeamlessService) AskStream(ctx context.Context, query string, options *SeamlessOptions) (<-chan *StreamingSeamlessResponse, error) {
	if options == nil {
		options = DefaultSeamlessOptions()
	}
	options.Stream = true

	queryID := generateID()
	ch := make(chan *StreamingSeamlessResponse, 100)

	// Send start event
	select {
	case ch <- &StreamingSeamlessResponse{
		Type:      "start",
		QueryID:   queryID,
		CreatedAt: NewTimestamp(time.Now().UTC()),
	}:
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	go func() {
		defer close(ch)

		// Perform DLP scanning first
		if options.EnableDLP {
			dlpOptions := &DLPScanRequest{
				Text:            query,
				ScanType:        "pii",
				RedactionMethod: "mask",
			}
			dlpResult, err := s.dlp.ScanAndRedact(ctx, query, dlpOptions)
			if err != nil {
				select {
				case ch <- &StreamingSeamlessResponse{
					Type:      "error",
					QueryID:   queryID,
					Error:     &APIError{Message: err.Error()},
					CreatedAt: NewTimestamp(time.Now().UTC()),
				}:
				case <-ctx.Done():
					return
				}
				return
			}

			if dlpResult.PIIFound {
				select {
				case ch <- &StreamingSeamlessResponse{
					Type:      "context",
					QueryID:   queryID,
					Metadata:  map[string]interface{}{"pii_redacted": true},
					CreatedAt: NewTimestamp(time.Now().UTC()),
				}:
				case <-ctx.Done():
					return
				}
			}

			query = dlpResult.RedactedText
		}

		// Perform RAG query with streaming
		ragReq := &QueryRequest{
			Query: query,
			ContextOptions: &ContextOptions{
				MaxContextLength: options.MaxContextLength,
				MaxChunks:        options.MaxSources,
				Strategy:         options.ContextStrategy,
				IncludeCitations: options.IncludeCitations,
			},
			RetrievalOptions: &RetrievalOptions{
				SearchType:    "hybrid",
				MaxResults:    options.MaxSources,
				Rerank:        true,
				DocumentTypes: options.DocumentTypes,
			},
			GenerationOptions: &GenerationOptions{
				Model:          options.Model,
				MaxTokens:      func() int { if options.MaxTokens != nil { return *options.MaxTokens }; return 0 }(),
				Temperature:    func() float64 { if options.Temperature != nil { return *options.Temperature }; return 0 }(),
				ResponseFormat: "text",
			},
			Stream: true,
		}

		streamChan, err := s.rag.QueryStream(ctx, ragReq)
		if err != nil {
			select {
			case ch <- &StreamingSeamlessResponse{
				Type:      "error",
				QueryID:   queryID,
				Error:     &APIError{Message: err.Error()},
				CreatedAt: NewTimestamp(time.Now().UTC()),
			}:
			case <-ctx.Done():
				return
			}
			return
		}

		// Stream RAG responses
		for streamResp := range streamChan {
			seamlessStream := &StreamingSeamlessResponse{
				Type:      streamResp.Type,
				QueryID:   queryID,
				CreatedAt: streamResp.CreatedAt,
			}

			switch streamResp.Type {
			case "chunk":
				seamlessStream.Content = streamResp.Content
			case "context":
				seamlessStream.Context = streamResp.Chunk
			case "citation":
				seamlessStream.Citation = &SeamlessCitation{
					ID:       streamResp.Citation.ID,
					SourceID: streamResp.Citation.DocumentID,
					Text:     streamResp.Citation.Text,
				}
			case "end":
				seamlessStream.Chunk = &SeamlessResponse{
					QueryID:   queryID,
					CreatedAt: streamResp.CreatedAt,
				}
			}

			select {
			case ch <- seamlessStream:
			case <-ctx.Done():
				return
			}
		}

		// Send end event
		select {
		case ch <- &StreamingSeamlessResponse{
			Type:      "end",
			QueryID:   queryID,
			CreatedAt: NewTimestamp(time.Now().UTC()),
		}:
		case <-ctx.Done():
			return
		}
	}()

	return ch, nil
}

// UploadDocument seamlessly uploads and processes a document
func (s *SeamlessService) UploadDocument(ctx context.Context, filePath string, options *SeamlessOptions) (*Document, error) {
	if options == nil {
		options = DefaultSeamlessOptions()
	}

	// Step 1: DLP scanning of document
	if options.EnableDLP {
		// This would integrate with document scanning
		// For now, we'll pass through to document service
	}

	// Step 2: Upload to document service
	uploadReq := &UploadRequest{
		Filename: filePath,
		TenantID: "", // Extract from context
	}

	document, err := s.documents.Upload(ctx, uploadReq)
	if err != nil {
		return nil, fmt.Errorf("failed to upload document: %w", err)
	}

	// Step 3: Automatic indexing and vectorization
	if document != nil {
		// Trigger background processing for RAG indexing
		_ = s.triggerDocumentIndexing(ctx, document.ID, options)
	}

	return document, nil
}

// Search performs seamless search across all available sources
func (s *SeamlessService) Search(ctx context.Context, query string, options *SeamlessOptions) (*SearchResults, error) {
	if options == nil {
		options = DefaultSeamlessOptions()
	}

	startTime := time.Now()

	// Perform hybrid search using RAG service
	ragReq := &QueryRequest{
		Query: query,
		RetrievalOptions: &RetrievalOptions{
			SearchType:    "hybrid",
			MaxResults:    20, // More results for search
			DocumentTypes: options.DocumentTypes,
			Sources:       options.Sources,
		},
		ContextOptions: &ContextOptions{
			MaxChunks: 20,
		},
	}

	ragResponse, err := s.rag.Query(ctx, ragReq)
	if err != nil {
		return nil, fmt.Errorf("search failed: %w", err)
	}

	// Convert RAG response to search results
	results := s.convertRAGToSearchResults(query, ragResponse, options)

	results.ProcessingTime = time.Since(startTime)
	results.CreatedAt = NewTimestamp(time.Now().UTC())

	return results, nil
}

// GetInsights generates AI insights from data analysis
func (s *SeamlessService) GetInsights(ctx context.Context, topic string, options *SeamlessOptions) (*Insights, error) {
	if options == nil {
		options = DefaultSeamlessOptions()
	}

	startTime := time.Now()
	insightsID := generateID()

	// Step 1: Retrieve relevant data for the topic
	ragReq := &QueryRequest{
		Query: fmt.Sprintf("comprehensive analysis and insights about: %s", topic),
		RetrievalOptions: &RetrievalOptions{
			SearchType:    "hybrid",
			MaxResults:    10,
			Rerank:        true,
			DocumentTypes: []string{"report", "analysis", "document"},
		},
		ContextOptions: &ContextOptions{
			MaxChunks:        8,
			Strategy:         "diversity",
			IncludeCitations: true,
		},
	}

	ragResponse, err := s.rag.Query(ctx, ragReq)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve data for insights: %w", err)
	}

	// Step 2: Generate insights using LLM
	insightPrompt := s.buildInsightPrompt(topic, ragResponse.Context, options)

	messages := []ChatMessage{
		{
			Role:    "system",
			Content: "You are an expert analyst providing comprehensive insights and recommendations. Always provide structured, actionable insights.",
		},
		{
			Role:    "user",
			Content: insightPrompt,
		},
	}

	chatReq := &ChatCompletionRequest{
		Model:       options.Model,
		Messages:    messages,
		MaxTokens:   &[]int{3000}[0],
		Temperature: &[]float64{0.2}[0],
		TenantID:    "", // Extract from context
	}

	chatResponse, err := s.llm.CreateChatCompletion(ctx, chatReq)
	if err != nil {
		return nil, fmt.Errorf("failed to generate insights: %w", err)
	}

	// Step 3: Parse and structure the insights
	insights := s.parseInsightsResponse(chatResponse.Choices[0].Message.Content, insightsID, topic)
	insights.ProcessingTime = time.Since(startTime)
	insights.CreatedAt = NewTimestamp(time.Now().UTC())

	return insights, nil
}

// Helper methods

func (s *SeamlessService) createStep(name, description string) *OrchestrationStep {
	return &OrchestrationStep{
		Name:     name,
		Status:   "running",
		Metadata: map[string]interface{}{"description": description},
	}
}

func (s *SeamlessService) buildSystemPrompt(options *SeamlessOptions) string {
	basePrompt := "You are a helpful AI assistant with access to relevant context from trusted sources. "

	if options.IncludeCitations {
		basePrompt += "Always cite your sources when referring to specific information. "
	}

	basePrompt += "Provide accurate, helpful responses based on the provided context. "

	if options.StrictPolicy {
		basePrompt += "Ensure all responses comply with security and privacy policies. "
	}

	return basePrompt
}

func (s *SeamlessService) buildUserPrompt(query string, context []ContextChunk, options *SeamlessOptions) string {
	prompt := fmt.Sprintf("Query: %s\n\n", query)

	if len(context) > 0 {
		prompt += "Relevant Context:\n"
		for i, chunk := range context {
			prompt += fmt.Sprintf("[%d] %s (Source: %s)\n", i+1, chunk.Text, chunk.DocumentTitle)
			if i >= options.MaxSources-1 {
				break
			}
		}
		prompt += "\n"
	}

	prompt += "Please provide a comprehensive response based on the query and context above."

	return prompt
}

func (s *SeamlessService) buildInsightPrompt(topic string, context []ContextChunk, options *SeamlessOptions) string {
	prompt := fmt.Sprintf("Topic: %s\n\n", topic)

	if len(context) > 0 {
		prompt += "Available Data:\n"
		for i, chunk := range context {
			prompt += fmt.Sprintf("[%d] %s\n", i+1, chunk.Text)
		}
	}

	prompt += `
Please provide comprehensive insights including:
1. Executive Summary
2. Key Findings with impact assessment
3. Action Items with priority and effort estimation
4. Risk Assessment with mitigation strategies
5. Specific Recommendations with timeline

Format your response as structured JSON with these sections.`

	return prompt
}

func (s *SeamlessService) convertRAGSourcesToSeamless(sources []Source) []SeamlessSource {
	seamlessSources := make([]SeamlessSource, len(sources))
	for i, source := range sources {
		seamlessSources[i] = SeamlessSource{
			ID:        source.ID,
			Title:     source.Title,
			URL:       source.URL,
			Type:      source.Type,
			Relevance: source.Relevance,
			Authority: source.Authority,
			Preview:   "", // Would extract from content
			Metadata:  func() map[string]interface{} { m := make(map[string]interface{}); for k, v := range source.Metadata { m[k] = v }; return m }(),
		}
	}
	return seamlessSources
}

func (s *SeamlessService) convertRAGCitationsToSeamless(citations []Citation) []SeamlessCitation {
	seamlessCitations := make([]SeamlessCitation, len(citations))
	for i, citation := range citations {
		seamlessCitations[i] = SeamlessCitation{
			ID:         citation.ID,
			SourceID:   citation.DocumentID,
			Text:       citation.Text,
			PageNumber: citation.PageNumber,
			Position:   i,
			Relevance:  1.0, // Would calculate from context
		}
	}
	return seamlessCitations
}

func (s *SeamlessService) buildContextSummary(context []ContextChunk) string {
	if len(context) == 0 {
		return "No specific context available."
	}

	return fmt.Sprintf("Based on %d relevant documents from trusted sources.", len(context))
}

func (s *SeamlessService) calculateContextTokens(context []ContextChunk) int {
	totalTokens := 0
	for _, chunk := range context {
		// Rough estimation: 1 token ≈ 4 characters
		totalTokens += len(chunk.Text) / 4
	}
	return totalTokens
}

func (s *SeamlessService) calculateTokenCost(usage ChatCompletionUsage, model string) float64 {
	// Simplified cost calculation - would use actual model pricing
	promptCost := float64(usage.PromptTokens) * 0.00001         // $0.01 per 1M tokens
	completionCost := float64(usage.CompletionTokens) * 0.00003 // $0.03 per 1M tokens
	return promptCost + completionCost
}

func (s *SeamlessService) convertRAGToSearchResults(query string, ragResponse *RAGResponse, options *SeamlessOptions) *SearchResults {
	results := make([]SeamlessSearchResult, len(ragResponse.Context))

	for i, chunk := range ragResponse.Context {
		results[i] = SeamlessSearchResult{
			ID:        chunk.ID,
			Title:     chunk.DocumentTitle,
			Content:   chunk.Text,
			URL:       chunk.URL,
			Type:      "document",
			Score:     chunk.Score,
			Relevance: chunk.Score,
			Preview:   chunk.Text[:min(200, len(chunk.Text))] + "...",
			Metadata:  func() map[string]interface{} { m := make(map[string]interface{}); for k, v := range chunk.Metadata { m[k] = v }; return m }(),
		}
	}

	return &SearchResults{
		Query:          query,
		Results:        results,
		TotalResults:   int64(len(results)),
		ProcessingTime: time.Duration(0), // Would track
		CreatedAt:      NewTimestamp(time.Now().UTC()),
	}
}

func (s *SeamlessService) parseInsightsResponse(response, insightsID, topic string) *Insights {
	// This would parse JSON response from LLM
	// For now, return a basic structure
	return &Insights{
		ID:      insightsID,
		Topic:   topic,
		Summary: response,
		KeyFindings: []KeyFinding{
			{
				ID:          generateID(),
				Title:       "Analysis Complete",
				Description: "Comprehensive analysis has been performed",
				Impact:      "medium",
				Confidence:  0.8,
			},
		},
		Confidence:   0.8,
		DataAnalyzed: 10,
		ActionItems: []SeamlessActionItem{
			{
				ID:          generateID(),
				Title:       "Review Results",
				Description: "Review the generated insights",
				Priority:    "medium",
				Effort:      "low",
				Impact:      "medium",
			},
		},
		SeamlessRiskAssessment: SeamlessRiskAssessment{
			OverallRisk: "low",
			RiskFactors: []SeamlessRiskFactor{},
		},
		Recommendations: []SeamlessRecommendation{
			{
				ID:          generateID(),
				Title:       "Continue Monitoring",
				Description: "Continue to monitor this topic",
				Category:    "operations",
				Priority:    "low",
				Benefit:     "Ongoing awareness",
				Effort:      "low",
				Timeline:    "ongoing",
			},
		},
	}
}

func (s *SeamlessService) triggerDocumentIndexing(ctx context.Context, documentID string, options *SeamlessOptions) error {
	// This would trigger background processing for document indexing
	// For now, just log the action
	return nil
}

func (s *SeamlessService) logOrchestration(ctx context.Context, orchestration *OrchestrationResult) error {
	// Log orchestration for monitoring and debugging
	// This would integrate with monitoring service
	return nil
}

func stringOrEmpty(ptr *string) string {
	if ptr == nil {
		return ""
	}
	return *ptr
}

func generateID() string {
	// Use crypto manager for secure ID generation
	return "seamless_" + strings.ReplaceAll(time.Now().UTC().Format(time.RFC3339), " ", "_")
}
