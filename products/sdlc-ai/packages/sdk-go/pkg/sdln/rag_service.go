package sdln

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// RAGService handles RAG (Retrieval-Augmented Generation) operations
type RAGService struct {
	*BaseService
}

// NewRAGService creates a new RAG service
func NewRAGService(client *Client) *RAGService {
	return &RAGService{
		BaseService: NewBaseService(client, "rag", "api/v1/rag"),
	}
}

// QueryRequest represents a RAG query request
type QueryRequest struct {
	Query             string             `json:"query"`
	TenantID          string             `json:"tenant_id"`
	ContextOptions    *ContextOptions    `json:"context_options,omitempty"`
	RetrievalOptions  *RetrievalOptions  `json:"retrieval_options,omitempty"`
	GenerationOptions *GenerationOptions `json:"generation_options,omitempty"`
	ConversationID    *string            `json:"conversation_id,omitempty"`
	SessionID         *string            `json:"session_id,omitempty"`
	UserID            *string            `json:"user_id,omitempty"`
	Metadata          map[string]string  `json:"metadata,omitempty"`
	Stream            bool               `json:"stream,omitempty"`
}

// ContextOptions controls context retrieval and assembly
type ContextOptions struct {
	MaxContextLength int     `json:"max_context_length,omitempty"`
	MaxChunks        int     `json:"max_chunks,omitempty"`
	MinSimilarity    float64 `json:"min_similarity,omitempty"`
	Strategy         string  `json:"strategy,omitempty"` // simple, weighted, diversity, adaptive
	IncludeCitations bool    `json:"include_citations,omitempty"`
	RecencyWeight    float64 `json:"recency_weight,omitempty"`
	AuthorityWeight  float64 `json:"authority_weight,omitempty"`
	DiversityWeight  float64 `json:"diversity_weight,omitempty"`
}

// RetrievalOptions controls document retrieval
type RetrievalOptions struct {
	SearchType    string            `json:"search_type,omitempty"` // semantic, hybrid, keyword
	VectorIndex   string            `json:"vector_index,omitempty"`
	Filters       map[string]string `json:"filters,omitempty"`
	DocumentTypes []string          `json:"document_types,omitempty"`
	Sources       []string          `json:"sources,omitempty"`
	DateRange     *DateRange        `json:"date_range,omitempty"`
	Rerank        bool              `json:"rerank,omitempty"`
	RerankModel   string            `json:"rerank_model,omitempty"`
	MaxResults    int               `json:"max_results,omitempty"`
}

// GenerationOptions controls LLM generation
type GenerationOptions struct {
	Model            string   `json:"model,omitempty"`
	MaxTokens        int      `json:"max_tokens,omitempty"`
	Temperature      float64  `json:"temperature,omitempty"`
	TopP             float64  `json:"top_p,omitempty"`
	FrequencyPenalty float64  `json:"frequency_penalty,omitempty"`
	PresencePenalty  float64  `json:"presence_penalty,omitempty"`
	StopSequences    []string `json:"stop_sequences,omitempty"`
	SystemPrompt     string   `json:"system_prompt,omitempty"`
	ChatPrompt       string   `json:"chat_prompt,omitempty"`
	ResponseFormat   string   `json:"response_format,omitempty"` // text, json, markdown
}

// DateRange represents a date range filter
type DateRange struct {
	From *Timestamp `json:"from,omitempty"`
	To   *Timestamp `json:"to,omitempty"`
}

// RAGResponse represents a RAG query response
type RAGResponse struct {
	QueryID           string            `json:"query_id"`
	Answer            string            `json:"answer"`
	Context           []ContextChunk    `json:"context"`
	Citations         []Citation        `json:"citations,omitempty"`
	Sources           []Source          `json:"sources,omitempty"`
	Confidence        float64           `json:"confidence"`
	TokensUsed        TokenUsage        `json:"tokens_used"`
	ResponseTime      time.Duration     `json:"response_time"`
	ConversationID    string            `json:"conversation_id"`
	SessionID         string            `json:"session_id"`
	Metadata          map[string]string `json:"metadata,omitempty"`
	FollowupQuestions []string          `json:"followup_questions,omitempty"`
	CreatedAt         Timestamp              `json:"created_at"`
}

// ContextChunk represents a chunk of context
type ContextChunk struct {
	ID            string            `json:"id"`
	DocumentID    string            `json:"document_id"`
	DocumentTitle string            `json:"document_title"`
	Text          string            `json:"text"`
	PageNumber    *int              `json:"page_number,omitempty"`
	Score         float64           `json:"score"`
	Source        string            `json:"source"`
	URL           string            `json:"url,omitempty"`
	Metadata      map[string]string `json:"metadata,omitempty"`
}

// Citation represents a citation reference
type Citation struct {
	ID         string   `json:"id"`
	ChunkID    string   `json:"chunk_id"`
	DocumentID string   `json:"document_id"`
	Title      string   `json:"title"`
	Authors    []string `json:"authors,omitempty"`
	URL        string   `json:"url,omitempty"`
	PageNumber *int     `json:"page_number,omitempty"`
	Format     string   `json:"format"` // apa, mla, chicago, harvard
	Text       string   `json:"text"`
}

// Source represents a document source
type Source struct {
	ID          string            `json:"id"`
	Title       string            `json:"title"`
	Authors     []string          `json:"authors,omitempty"`
	URL         string            `json:"url,omitempty"`
	Type        string            `json:"type"` // pdf, html, doc, etc.
	PublishedAt *Timestamp             `json:"published_at,omitempty"`
	Relevance   float64           `json:"relevance"`
	Authority   float64           `json:"authority"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

// TokenUsage represents token usage statistics
type TokenUsage struct {
	Prompt     int `json:"prompt"`
	Completion int `json:"completion"`
	Total      int `json:"total"`
}

// Query performs a RAG query
func (s *RAGService) Query(ctx context.Context, req *QueryRequest) (*RAGResponse, error) {
	var response RAGResponse
	err := s.doPost(ctx, "/query", req, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to perform RAG query: %w", err)
	}
	return &response, nil
}

// QueryStream performs a streaming RAG query
func (s *RAGService) QueryStream(ctx context.Context, req *QueryRequest) (<-chan *StreamingRAGResponse, error) {
	req.Stream = true

	// Create streaming request
	fullURL := s.serviceURL + "/query/stream"

	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", fullURL, bytes.NewReader(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")
	httpReq.Header.Set("Cache-Control", "no-cache")

	// Add authentication
	if s.client.auth != nil {
		httpReq := newHTTPRequest(httpReq)
		if err := s.client.auth.Authenticate(ctx, httpReq); err != nil {
			return nil, fmt.Errorf("authentication failed: %w", err)
		}
	}

	resp, err := s.client.do(ctx, httpReq)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, &APIError{
			Type:       getErrorTypeFromStatus(resp.StatusCode),
			Message:    string(body),
			StatusCode: resp.StatusCode,
			Timestamp:  time.Now().UTC(),
		}
	}

	ch := make(chan *StreamingRAGResponse, 100)

	go func() {
		defer resp.Body.Close()
		defer close(ch)

		scanner := bufio.NewScanner(resp.Body)
		for scanner.Scan() {
			line := scanner.Text()
			if line == "" {
				continue
			}

			if strings.HasPrefix(line, "data: ") {
				data := strings.TrimPrefix(line, "data: ")
				if data == "[DONE]" {
					return
				}

				var streamResp StreamingRAGResponse
				if err := json.Unmarshal([]byte(data), &streamResp); err != nil {
					continue
				}

				select {
				case ch <- &streamResp:
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	return ch, nil
}

// StreamingRAGResponse represents a streaming RAG response
type StreamingRAGResponse struct {
	Type      string            `json:"type"` // start, chunk, context, citation, end
	Content   string            `json:"content,omitempty"`
	Chunk     *ContextChunk     `json:"chunk,omitempty"`
	Citation  *Citation         `json:"citation,omitempty"`
	Metadata  map[string]string `json:"metadata,omitempty"`
	QueryID   string            `json:"query_id,omitempty"`
	CreatedAt Timestamp              `json:"created_at"`
}

// GetHistory retrieves conversation history
func (s *RAGService) GetHistory(ctx context.Context, conversationID string, opts *ListOptions) (*PaginatedResponse[ConversationMessage], error) {
	path := fmt.Sprintf("/conversations/%s/history", conversationID)
	if opts != nil {
		path += s.buildQuery(map[string]interface{}{
			"page":      opts.Page,
			"page_size": opts.PageSize,
			"sort_by":   opts.SortBy,
			"sort_desc": opts.SortDesc,
		})
	}

	var response PaginatedResponse[ConversationMessage]
	err := s.doGet(ctx, path, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get conversation history: %w", err)
	}
	return &response, nil
}

// ConversationMessage represents a conversation message
type ConversationMessage struct {
	ID             string            `json:"id"`
	ConversationID string            `json:"conversation_id"`
	SessionID      string            `json:"session_id"`
	Role           string            `json:"role"` // user, assistant, system
	Content        string            `json:"content"`
	Context        []ContextChunk    `json:"context,omitempty"`
	Citations      []Citation        `json:"citations,omitempty"`
	TokensUsed     TokenUsage        `json:"tokens_used,omitempty"`
	Metadata       map[string]string `json:"metadata,omitempty"`
	CreatedAt      Timestamp              `json:"created_at"`
}

// CreateConversation creates a new conversation
func (s *RAGService) CreateConversation(ctx context.Context, tenantID, userID string, metadata map[string]string) (*Conversation, error) {
	req := map[string]interface{}{
		"tenant_id": tenantID,
		"user_id":   userID,
		"metadata":  metadata,
	}

	var conversation Conversation
	err := s.doPost(ctx, "/conversations", req, &conversation)
	if err != nil {
		return nil, fmt.Errorf("failed to create conversation: %w", err)
	}
	return &conversation, nil
}

// GetConversation retrieves a conversation
func (s *RAGService) GetConversation(ctx context.Context, conversationID string) (*Conversation, error) {
	var conversation Conversation
	err := s.doGet(ctx, fmt.Sprintf("/conversations/%s", conversationID), &conversation)
	if err != nil {
		return nil, fmt.Errorf("failed to get conversation: %w", err)
	}
	return &conversation, nil
}

// DeleteConversation deletes a conversation
func (s *RAGService) DeleteConversation(ctx context.Context, conversationID string) error {
	err := s.doDelete(ctx, fmt.Sprintf("/conversations/%s", conversationID))
	if err != nil {
		return fmt.Errorf("failed to delete conversation: %w", err)
	}
	return nil
}

// GetFeedback retrieves feedback for responses
func (s *RAGService) GetFeedback(ctx context.Context, queryID string) (*QueryFeedback, error) {
	var feedback QueryFeedback
	err := s.doGet(ctx, fmt.Sprintf("/queries/%s/feedback", queryID), &feedback)
	if err != nil {
		return nil, fmt.Errorf("failed to get feedback: %w", err)
	}
	return &feedback, nil
}

// SubmitFeedback submits feedback for a response
func (s *RAGService) SubmitFeedback(ctx context.Context, queryID string, feedback *FeedbackRequest) error {
	err := s.doPost(ctx, fmt.Sprintf("/queries/%s/feedback", queryID), feedback, nil)
	if err != nil {
		return fmt.Errorf("failed to submit feedback: %w", err)
	}
	return nil
}

// FeedbackRequest represents a feedback request
type FeedbackRequest struct {
	Rating     int               `json:"rating"` // 1-5
	Comment    string            `json:"comment,omitempty"`
	Helpful    bool              `json:"helpful"`
	Accurate   bool              `json:"accurate"`
	Complete   bool              `json:"complete"`
	Categories []string          `json:"categories,omitempty"`
	Metadata   map[string]string `json:"metadata,omitempty"`
}

// QueryFeedback represents query feedback
type QueryFeedback struct {
	QueryID    string            `json:"query_id"`
	UserID     string            `json:"user_id"`
	Rating     int               `json:"rating"`
	Comment    string            `json:"comment,omitempty"`
	Helpful    bool              `json:"helpful"`
	Accurate   bool              `json:"accurate"`
	Complete   bool              `json:"complete"`
	Categories []string          `json:"categories"`
	Metadata   map[string]string `json:"metadata"`
	CreatedAt  Timestamp              `json:"created_at"`
	UpdatedAt  Timestamp              `json:"updated_at"`
}

// Conversation represents a conversation
type Conversation struct {
	ID            string            `json:"id"`
	TenantID      string            `json:"tenant_id"`
	UserID        string            `json:"user_id"`
	Title         string            `json:"title,omitempty"`
	Status        string            `json:"status"` // active, archived, deleted
	MessageCount  int               `json:"message_count"`
	LastMessageAt *Timestamp             `json:"last_message_at,omitempty"`
	Metadata      map[string]string `json:"metadata"`
	CreatedAt     Timestamp              `json:"created_at"`
	UpdatedAt     Timestamp              `json:"updated_at"`
}
