package sdln

import (
	"context"
	"crypto/sha256"
	"fmt"
	"html/template"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// DocumentationService handles comprehensive documentation management
type DocumentationService struct {
	baseService
	documents      map[string]*Document
	versions       map[string][]*DocumentVersion
	searchIndex    *SearchIndex
	analytics      *DocumentationAnalytics
	renderer       *DocumentationRenderer
	cache          *DocumentationCache
	validator      *DocumentationValidator
	mu             sync.RWMutex
	templateEngine *template.Template
	translations   map[string]map[string]string
}

// Document represents a documentation document
type Document struct {
	ID              string                 `json:"id"`
	Title           string                 `json:"title"`
	Content         string                 `json:"content"`
	Type            DocumentType           `json:"type"`
	Category        string                 `json:"category"`
	Tags            []string               `json:"tags"`
	Author          string                 `json:"author"`
	Status          DocumentStatus         `json:"status"`
	Language        string                 `json:"language"`
	Version         string                 `json:"version"`
	CreatedAt       time.Time              `json:"created_at"`
	UpdatedAt       time.Time              `json:"updated_at"`
	PublishedAt     *time.Time             `json:"published_at"`
	ViewCount       int64                  `json:"view_count"`
	Rating          float64                `json:"rating"`
	Feedback        []DocumentFeedback     `json:"feedback"`
	Metadata        map[string]interface{} `json:"metadata"`
	SEO             SEOData                `json:"seo"`
	RelatedDocs     []string               `json:"related_docs"`
	TableOfContents TOCEntry               `json:"table_of_contents"`
	CodeExamples    []CodeExample          `json:"code_examples"`
	Interactive     InteractiveElements    `json:"interactive"`
}

// DocumentVersion represents a version of a document
type DocumentVersion struct {
	ID         string    `json:"id"`
	DocumentID string    `json:"document_id"`
	Version    string    `json:"version"`
	Content    string    `json:"content"`
	Changes    string    `json:"changes"`
	Author     string    `json:"author"`
	CreatedAt  time.Time `json:"created_at"`
	Changelog  []string  `json:"changelog"`
}

// DocumentType represents the type of document
type DocumentType string

const (
	DocumentTypeAPI          DocumentType = "api"
	DocumentTypeGuide        DocumentType = "guide"
	DocumentTypeTutorial     DocumentType = "tutorial"
	DocumentTypeReference    DocumentType = "reference"
	DocumentTypeExample      DocumentType = "example"
	DocumentTypeFAQ          DocumentType = "faq"
	DocumentTypeTroubleshoot DocumentType = "troubleshoot"
	DocumentTypeBestPractice DocumentType = "best_practice"
	DocumentTypeMigration    DocumentType = "migration"
	DocumentTypeSecurity     DocumentType = "security"
	DocumentTypeDeployment   DocumentType = "deployment"
	DocumentTypeTraining     DocumentType = "training"
	DocumentTypeVideo        DocumentType = "video"
)

// DocumentStatus represents the status of a document
type DocumentStatus string

const (
	DocumentStatusDraft      DocumentStatus = "draft"
	DocumentStatusReview     DocumentStatus = "review"
	DocumentStatusPublished  DocumentStatus = "published"
	DocumentStatusArchived   DocumentStatus = "archived"
	DocumentStatusDeprecated DocumentStatus = "deprecated"
)

// DocumentFeedback represents user feedback on a document
type DocumentFeedback struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Rating    int       `json:"rating"`
	Comment   string    `json:"comment"`
	Helpful   bool      `json:"helpful"`
	CreatedAt time.Time `json:"created_at"`
	Type      string    `json:"type"`
}

// SEOData contains SEO information for the document
type SEOData struct {
	Title       string            `json:"title"`
	Description string            `json:"description"`
	Keywords    []string          `json:"keywords"`
	OpenGraph   map[string]string `json:"open_graph"`
	Twitter     map[string]string `json:"twitter"`
}

// TOCEntry represents a table of contents entry
type TOCEntry struct {
	Title    string     `json:"title"`
	Level    int        `json:"level"`
	Anchor   string     `json:"anchor"`
	Children []TOCEntry `json:"children"`
}

// CodeExample represents a code example in a document
type CodeExample struct {
	ID          string `json:"id"`
	Language    string `json:"language"`
	Code        string `json:"code"`
	Description string `json:"description"`
	Runnable    bool   `json:"runnable"`
	Output      string `json:"output"`
}

// InteractiveElements represents interactive elements in a document
type InteractiveElements struct {
	Playgrounds []Playground `json:"playgrounds"`
	Demos       []Demo       `json:"demos"`
	Quizzes     []Quiz       `json:"quizzes"`
	Exercises   []Exercise   `json:"exercises"`
}

// Playground represents an interactive playground
type Playground struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Content  string `json:"content"`
	Template string `json:"template"`
}

// Demo represents an interactive demo
type Demo struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	URL         string `json:"url"`
	EmbedCode   string `json:"embed_code"`
}

// Quiz represents a quiz element
type Quiz struct {
	ID          string   `json:"id"`
	Question    string   `json:"question"`
	Options     []string `json:"options"`
	Answer      int      `json:"answer"`
	Explanation string   `json:"explanation"`
}

// Exercise represents an exercise element
type Exercise struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Task        string   `json:"task"`
	Solution    string   `json:"solution"`
	Hints       []string `json:"hints"`
}

// SearchIndex handles document search functionality
type SearchIndex struct {
	Documents map[string]*SearchDocument `json:"documents"`
	Terms     map[string][]string        `json:"terms"`
	mu        sync.RWMutex
}

// SearchDocument represents a document in the search index
type SearchDocument struct {
	ID      string    `json:"id"`
	Title   string    `json:"title"`
	Content string    `json:"content"`
	Tags    []string  `json:"tags"`
	Tokens  []string  `json:"tokens"`
	Vector  []float64 `json:"vector"`
}

// DocumentationAnalytics handles analytics for documentation
type DocumentationAnalytics struct {
	Views       map[string]*ViewStats       `json:"views"`
	Searches    map[string]*SearchStats     `json:"searches"`
	Feedback    map[string]*FeedbackStats   `json:"feedback"`
	Engagement  map[string]*EngagementStats `json:"engagement"`
	Performance map[string]*PerfStats       `json:"performance"`
	mu          sync.RWMutex
}

// ViewStats represents view statistics
type ViewStats struct {
	TotalViews   int64     `json:"total_views"`
	UniqueViews  int64     `json:"unique_views"`
	AvgTimeSpent float64   `json:"avg_time_spent"`
	BounceRate   float64   `json:"bounce_rate"`
	LastViewed   time.Time `json:"last_viewed"`
}

// SearchStats represents search statistics
type SearchStats struct {
	TotalSearches int64            `json:"total_searches"`
	ClickThrough  float64          `json:"click_through"`
	TopQueries    map[string]int64 `json:"top_queries"`
	NoResults     int64            `json:"no_results"`
	LastSearched  time.Time        `json:"last_searched"`
}

// FeedbackStats represents feedback statistics
type FeedbackStats struct {
	TotalFeedback   int64     `json:"total_feedback"`
	AverageRating   float64   `json:"average_rating"`
	HelpfulCount    int64     `json:"helpful_count"`
	NotHelpfulCount int64     `json:"not_helpful_count"`
	LastFeedback    time.Time `json:"last_feedback"`
}

// EngagementStats represents engagement statistics
type EngagementStats struct {
	ScrollDepth  float64 `json:"scroll_depth"`
	TimeOnPage   float64 `json:"time_on_page"`
	Interactions int64   `json:"interactions"`
	Shares       int64   `json:"shares"`
	Bookmarks    int64   `json:"bookmarks"`
	Comments     int64   `json:"comments"`
}

// PerfStats represents performance statistics
type PerfStats struct {
	LoadTime     float64   `json:"load_time"`
	RenderTime   float64   `json:"render_time"`
	SearchTime   float64   `json:"search_time"`
	ErrorRate    float64   `json:"error_rate"`
	LastMeasured time.Time `json:"last_measured"`
}

// DocumentationRenderer handles rendering documentation
type DocumentationRenderer struct {
	templates    map[string]*template.Template
	themes       map[string]*Theme
	formatters   map[string]Formatter
	highlighters map[string]Highlighter
	mu           sync.RWMutex
}

// Theme represents a documentation theme
type Theme struct {
	Name      string            `json:"name"`
	Styles    map[string]string `json:"styles"`
	Scripts   map[string]string `json:"scripts"`
	Layout    string            `json:"layout"`
	CustomCSS string            `json:"custom_css"`
	CustomJS  string            `json:"custom_js"`
}

// Formatter interface for content formatting
type Formatter interface {
	Format(content string, options map[string]interface{}) (string, error)
}

// Highlighter interface for code highlighting
type Highlighter interface {
	Highlight(code string, language string) (string, error)
}

// DocumentationCache handles caching for documentation
type DocumentationCache struct {
	documents    map[string]*CachedDocument
	renders      map[string]*CachedRender
	searches     map[string]*CachedSearch
	ttl          time.Duration
	maxSize      int
	mu           sync.RWMutex
	cleanupTimer *time.Timer
}

// CachedDocument represents a cached document
type CachedDocument struct {
	Document   *Document
	ExpiresAt  time.Time
	AccessedAt time.Time
}

// CachedRender represents a cached render
type CachedRender struct {
	HTML       string
	ExpiresAt  time.Time
	AccessedAt time.Time
}

// CachedSearch represents a cached search
type CachedSearch struct {
	Results    []*SearchResult
	ExpiresAt  time.Time
	AccessedAt time.Time
}

// SearchResult represents a search result
type SearchResult struct {
	Document   *Document `json:"document"`
	Score      float64   `json:"score"`
	Highlights []string  `json:"highlights"`
}

// DocumentationValidator validates documentation content
type DocumentationValidator struct {
	rules         []ValidationRule
	linter        *DocumentationLinter
	checker       *LinkChecker
	accessibility *AccessibilityChecker
}

// ValidationRule interface for validation rules
type ValidationRule interface {
	Validate(document *Document) []ValidationError
}

// ValidationError represents a validation error
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
	Level   string `json:"level"`
	Line    int    `json:"line"`
	Column  int    `json:"column"`
}

// DocumentationLinter checks documentation quality
type DocumentationLinter struct {
	rules map[string]*LintRule
}

// LintRule represents a linting rule
type LintRule struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Severity    string `json:"severity"`
	Pattern     string `json:"pattern"`
}

// LinkChecker checks links in documentation
type LinkChecker struct {
	client  HTTPClient
	cache   map[string]*LinkCheck
	timeout time.Duration
}

// LinkCheck represents a link check result
type LinkCheck struct {
	URL       string    `json:"url"`
	Status    int       `json:"status"`
	Valid     bool      `json:"valid"`
	Error     string    `json:"error"`
	CheckedAt time.Time `json:"checked_at"`
}

// AccessibilityChecker checks accessibility compliance
type AccessibilityChecker struct {
	rules map[string]*A11yRule
}

// A11yRule represents an accessibility rule
type A11yRule struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Level       string `json:"level"`
	Category    string `json:"category"`
}

// NewDocumentationService creates a new documentation service
func NewDocumentationService(config *Config) *DocumentationService {
	ds := &DocumentationService{
		baseService:    newBaseService("documentation", config),
		documents:      make(map[string]*Document),
		versions:       make(map[string][]*DocumentVersion),
		searchIndex:    NewSearchIndex(),
		analytics:      NewDocumentationAnalytics(),
		renderer:       NewDocumentationRenderer(),
		cache:          NewDocumentationCache(1000, 30*time.Minute),
		validator:      NewDocumentationValidator(),
		translations:   make(map[string]map[string]string),
		templateEngine: template.New("docs"),
	}

	// Load built-in templates
	ds.loadTemplates()

	// Load translations
	ds.loadTranslations()

	// Start background tasks
	go ds.startBackgroundTasks()

	return ds
}

// CreateDocument creates a new document
func (ds *DocumentationService) CreateDocument(ctx context.Context, doc *Document) (*Document, error) {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	// Validate document
	if err := ds.validator.ValidateDocument(doc); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	// Generate ID if not provided
	if doc.ID == "" {
		doc.ID = uuid.New().String()
	}

	// Set timestamps
	now := time.Now()
	doc.CreatedAt = now
	doc.UpdatedAt = now

	// Generate table of contents
	doc.TableOfContents = ds.generateTOC(doc.Content)

	// Extract code examples
	doc.CodeExamples = ds.extractCodeExamples(doc.Content)

	// Generate SEO data
	if doc.SEO.Title == "" {
		doc.SEO.Title = doc.Title
		doc.SEO.Description = ds.extractDescription(doc.Content)
		doc.SEO.Keywords = ds.extractKeywords(doc.Content)
	}

	// Store document
	ds.documents[doc.ID] = doc

	// Create initial version
	version := &DocumentVersion{
		ID:         uuid.New().String(),
		DocumentID: doc.ID,
		Version:    "1.0.0",
		Content:    doc.Content,
		Author:     doc.Author,
		CreatedAt:  now,
		Changelog:  []string{"Initial version"},
	}
	ds.versions[doc.ID] = append(ds.versions[doc.ID], version)

	// Update search index
	ds.searchIndex.IndexDocument(doc)

	// Log creation
	ds.logger.Info("Document created", "id", doc.ID, "title", doc.Title, "type", doc.Type)

	return doc, nil
}

// GetDocument retrieves a document by ID
func (ds *DocumentationService) GetDocument(ctx context.Context, id string) (*Document, error) {
	// Check cache first
	if cached := ds.cache.GetDocument(id); cached != nil {
		// Track view
		go ds.trackView(id, ctx.Value("user_id").(string))
		return cached, nil
	}

	ds.mu.RLock()
	doc, exists := ds.documents[id]
	ds.mu.RUnlock()

	if !exists {
		return nil, ErrDocumentNotFound
	}

	// Cache document
	ds.cache.SetDocument(id, doc)

	// Track view
	go ds.trackView(id, ctx.Value("user_id").(string))

	return doc, nil
}

// UpdateDocument updates an existing document
func (ds *DocumentationService) UpdateDocument(ctx context.Context, id string, updates map[string]interface{}) (*Document, error) {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	doc, exists := ds.documents[id]
	if !exists {
		return nil, ErrDocumentNotFound
	}

	// Store old content for versioning
	oldContent := doc.Content

	// Apply updates
	if title, ok := updates["title"].(string); ok {
		doc.Title = title
	}
	if content, ok := updates["content"].(string); ok {
		doc.Content = content
	}
	if tags, ok := updates["tags"].([]string); ok {
		doc.Tags = tags
	}
	if status, ok := updates["status"].(DocumentStatus); ok {
		doc.Status = status
		if status == DocumentStatusPublished && doc.PublishedAt == nil {
			now := time.Now()
			doc.PublishedAt = &now
		}
	}

	// Update timestamps
	doc.UpdatedAt = time.Now()

	// Regenerate table of contents
	doc.TableOfContents = ds.generateTOC(doc.Content)

	// Extract code examples
	doc.CodeExamples = ds.extractCodeExamples(doc.Content)

	// Create new version if content changed
	if oldContent != doc.Content {
		lastVersion := ds.versions[id][len(ds.versions[id])-1]
		newVersion := ds.incrementVersion(lastVersion.Version)

		version := &DocumentVersion{
			ID:         uuid.New().String(),
			DocumentID: id,
			Version:    newVersion,
			Content:    doc.Content,
			Author:     ctx.Value("user_id").(string),
			CreatedAt:  time.Now(),
		}

		if changes, ok := updates["changes"].(string); ok {
			version.Changes = changes
		}

		ds.versions[id] = append(ds.versions[id], version)
	}

	// Update search index
	ds.searchIndex.UpdateDocument(doc)

	// Invalidate cache
	ds.cache.InvalidateDocument(id)

	// Log update
	ds.logger.Info("Document updated", "id", id, "title", doc.Title)

	return doc, nil
}

// DeleteDocument deletes a document
func (ds *DocumentationService) DeleteDocument(ctx context.Context, id string) error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	if _, exists := ds.documents[id]; !exists {
		return ErrDocumentNotFound
	}

	delete(ds.documents, id)
	delete(ds.versions, id)

	// Remove from search index
	ds.searchIndex.RemoveDocument(id)

	// Invalidate cache
	ds.cache.InvalidateDocument(id)

	// Log deletion
	ds.logger.Info("Document deleted", "id", id)

	return nil
}

// ListDocuments lists documents with filtering and pagination
func (ds *DocumentationService) ListDocuments(ctx context.Context, filter *DocumentFilter) ([]*Document, int64, error) {
	ds.mu.RLock()
	defer ds.mu.RUnlock()

	var documents []*Document

	for _, doc := range ds.documents {
		if ds.matchesFilter(doc, filter) {
			documents = append(documents, doc)
		}
	}

	// Sort documents
	ds.sortDocuments(documents, filter.SortBy, filter.SortOrder)

	// Apply pagination
	total := int64(len(documents))
	if filter.Offset > 0 {
		if filter.Offset >= int64(len(documents)) {
			return []*Document{}, total, nil
		}
		documents = documents[filter.Offset:]
	}

	if filter.Limit > 0 && filter.Limit < int64(len(documents)) {
		documents = documents[:filter.Limit]
	}

	return documents, total, nil
}

// SearchDocuments searches for documents
func (ds *DocumentationService) SearchDocuments(ctx context.Context, query *SearchQuery) (*SearchResult, error) {
	// Check cache
	cacheKey := ds.getSearchCacheKey(query)
	if cached := ds.cache.GetSearch(cacheKey); cached != nil {
		go ds.trackSearch(query.Query, len(cached.Results), ctx.Value("user_id").(string))
		return &SearchResult{Results: cached.Results}, nil
	}

	// Perform search
	start := time.Now()
	results := ds.searchIndex.Search(query.SearchTerm, query.Filters)
	duration := time.Since(start)

	// Cache results
	ds.cache.SetSearch(cacheKey, results)

	// Track search
	go ds.trackSearch(query.Query, len(results), ctx.Value("user_id").(string))
	go ds.trackSearchPerformance(query.Query, duration)

	return &SearchResult{Results: results}, nil
}

// RenderDocument renders a document to HTML
func (ds *DocumentationService) RenderDocument(ctx context.Context, id string, options *RenderOptions) (string, error) {
	// Get document
	doc, err := ds.GetDocument(ctx, id)
	if err != nil {
		return "", err
	}

	// Check cache
	cacheKey := ds.getRenderCacheKey(id, options)
	if cached := ds.cache.GetRender(cacheKey); cached != nil {
		return cached.HTML, nil
	}

	// Render document
	html, err := ds.renderer.Render(doc, options)
	if err != nil {
		return "", fmt.Errorf("render failed: %w", err)
	}

	// Cache render
	ds.cache.SetRender(cacheKey, html)

	return html, nil
}

// AddFeedback adds feedback to a document
func (ds *DocumentationService) AddFeedback(ctx context.Context, docID string, feedback *DocumentFeedback) error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	doc, exists := ds.documents[docID]
	if !exists {
		return ErrDocumentNotFound
	}

	feedback.ID = uuid.New().String()
	feedback.CreatedAt = time.Now()
	feedback.UserID = ctx.Value("user_id").(string)

	doc.Feedback = append(doc.Feedback, feedback)

	// Update rating
	ds.updateDocumentRating(doc)

	// Invalidate cache
	ds.cache.InvalidateDocument(docID)

	// Track feedback
	go ds.trackFeedback(docID, feedback)

	return nil
}

// GetVersions retrieves document versions
func (ds *DocumentationService) GetVersions(ctx context.Context, docID string) ([]*DocumentVersion, error) {
	ds.mu.RLock()
	defer ds.mu.RUnlock()

	versions, exists := ds.versions[docID]
	if !exists {
		return nil, ErrDocumentNotFound
	}

	return versions, nil
}

// GetVersion retrieves a specific document version
func (ds *DocumentationService) GetVersion(ctx context.Context, docID, version string) (*DocumentVersion, error) {
	versions, err := ds.GetVersions(ctx, docID)
	if err != nil {
		return nil, err
	}

	for _, v := range versions {
		if v.Version == version {
			return v, nil
		}
	}

	return nil, ErrVersionNotFound
}

// Helper methods

func (ds *DocumentationService) matchesFilter(doc *Document, filter *DocumentFilter) bool {
	if filter == nil {
		return true
	}

	if filter.Type != "" && doc.Type != filter.Type {
		return false
	}

	if filter.Category != "" && doc.Category != filter.Category {
		return false
	}

	if filter.Status != "" && doc.Status != filter.Status {
		return false
	}

	if filter.Language != "" && doc.Language != filter.Language {
		return false
	}

	if len(filter.Tags) > 0 {
		hasTag := false
		for _, tag := range filter.Tags {
			for _, docTag := range doc.Tags {
				if tag == docTag {
					hasTag = true
					break
				}
			}
		}
		if !hasTag {
			return false
		}
	}

	if filter.Author != "" && doc.Author != filter.Author {
		return false
	}

	if !filter.DateFrom.IsZero() && doc.CreatedAt.Before(filter.DateFrom) {
		return false
	}

	if !filter.DateTo.IsZero() && doc.CreatedAt.After(filter.DateTo) {
		return false
	}

	return true
}

func (ds *DocumentationService) sortDocuments(docs []*Document, sortBy string, order SortOrder) {
	if sortBy == "" {
		sortBy = "updated_at"
	}

	switch sortBy {
	case "title":
		sort.Slice(docs, func(i, j int) bool {
			if order == SortOrderDesc {
				return docs[i].Title > docs[j].Title
			}
			return docs[i].Title < docs[j].Title
		})
	case "created_at":
		sort.Slice(docs, func(i, j int) bool {
			if order == SortOrderDesc {
				return docs[i].CreatedAt.After(docs[j].CreatedAt)
			}
			return docs[i].CreatedAt.Before(docs[j].CreatedAt)
		})
	case "updated_at":
		sort.Slice(docs, func(i, j int) bool {
			if order == SortOrderDesc {
				return docs[i].UpdatedAt.After(docs[j].UpdatedAt)
			}
			return docs[i].UpdatedAt.Before(docs[j].UpdatedAt)
		})
	case "view_count":
		sort.Slice(docs, func(i, j int) bool {
			if order == SortOrderDesc {
				return docs[i].ViewCount > docs[j].ViewCount
			}
			return docs[i].ViewCount < docs[j].ViewCount
		})
	case "rating":
		sort.Slice(docs, func(i, j int) bool {
			if order == SortOrderDesc {
				return docs[i].Rating > docs[j].Rating
			}
			return docs[i].Rating < docs[j].Rating
		})
	default:
		sort.Slice(docs, func(i, j int) bool {
			if order == SortOrderDesc {
				return docs[i].UpdatedAt.After(docs[j].UpdatedAt)
			}
			return docs[i].UpdatedAt.Before(docs[j].UpdatedAt)
		})
	}
}

func (ds *DocumentationService) generateTOC(content string) TOCEntry {
	lines := strings.Split(content, "\n")
	var root TOCEntry
	var stack []*TOCEntry

	headerRegex := regexp.MustCompile(`^(#{1,6})\s+(.+)$`)

	for _, line := range lines {
		matches := headerRegex.FindStringSubmatch(line)
		if matches == nil {
			continue
		}

		level := len(matches[1])
		title := strings.TrimSpace(matches[2])
		anchor := ds.generateAnchor(title)

		entry := TOCEntry{
			Title:  title,
			Level:  level,
			Anchor: anchor,
		}

		// Find parent
		for len(stack) >= level {
			stack = stack[:len(stack)-1]
		}

		if len(stack) == 0 {
			// Top level
			root.Children = append(root.Children, entry)
			stack = append(stack, &root.Children[len(root.Children)-1])
		} else {
			// Nested
			parent := stack[len(stack)-1]
			parent.Children = append(parent.Children, entry)
			stack = append(stack, &parent.Children[len(parent.Children)-1])
		}
	}

	return root
}

func (ds *DocumentationService) generateAnchor(title string) string {
	anchor := strings.ToLower(title)
	anchor = regexp.MustCompile(`[^a-z0-9\s-]`).ReplaceAllString(anchor, "")
	anchor = regexp.MustCompile(`\s+`).ReplaceAllString(anchor, "-")
	return strings.Trim(anchor, "-")
}

func (ds *DocumentationService) extractCodeExamples(content string) []CodeExample {
	var examples []CodeExample

	// Regex for fenced code blocks
	codeRegex := regexp.MustCompile("```([^\\n]+)\\n([\\s\\S]*?)```")
	matches := codeRegex.FindAllStringSubmatch(content, -1)

	for i, match := range matches {
		if len(match) >= 3 {
			examples = append(examples, CodeExample{
				ID:       fmt.Sprintf("example-%d", i+1),
				Language: match[1],
				Code:     match[2],
			})
		}
	}

	return examples
}

func (ds *DocumentationService) extractDescription(content string) string {
	// Extract first paragraph
	lines := strings.Split(content, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" && !strings.HasPrefix(line, "#") {
			// Truncate to 160 characters
			if len(line) > 160 {
				line = line[:157] + "..."
			}
			return line
		}
	}
	return ""
}

func (ds *DocumentationService) extractKeywords(content string) []string {
	// Simple keyword extraction
	words := regexp.MustCompile(`\b\w+\b`).FindAllString(content, -1)
	freq := make(map[string]int)

	for _, word := range words {
		if len(word) > 3 {
			freq[strings.ToLower(word)]++
		}
	}

	// Get top 10 keywords
	type kv struct {
		Key   string
		Value int
	}

	var sorted []kv
	for k, v := range freq {
		sorted = append(sorted, kv{k, v})
	}

	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Value > sorted[j].Value
	})

	var keywords []string
	for i, kv := range sorted {
		if i >= 10 {
			break
		}
		keywords = append(keywords, kv.Key)
	}

	return keywords
}

func (ds *DocumentationService) incrementVersion(version string) string {
	parts := strings.Split(version, ".")
	if len(parts) != 3 {
		return "1.0.1"
	}

	// Simple increment of patch version
	patch, _ := strconv.Atoi(parts[2])
	patch++

	return fmt.Sprintf("%s.%s.%d", parts[0], parts[1], patch)
}

func (ds *DocumentationService) updateDocumentRating(doc *Document) {
	if len(doc.Feedback) == 0 {
		doc.Rating = 0
		return
	}

	var total int
	for _, feedback := range doc.Feedback {
		total += feedback.Rating
	}
	doc.Rating = float64(total) / float64(len(doc.Feedback))
}

func (ds *DocumentationService) trackView(docID, userID string) {
	ds.analytics.TrackView(docID, userID)
}

func (ds *DocumentationService) trackSearch(query string, resultCount int, userID string) {
	ds.analytics.TrackSearch(query, resultCount, userID)
}

func (ds *DocumentationService) trackFeedback(docID string, feedback *DocumentFeedback) {
	ds.analytics.TrackFeedback(docID, feedback)
}

func (ds *DocumentationService) trackSearchPerformance(query string, duration time.Duration) {
	ds.analytics.TrackSearchPerformance(query, duration)
}

func (ds *DocumentationService) getSearchCacheKey(query *SearchQuery) string {
	h := sha256.New()
	h.Write([]byte(query.SearchTerm))
	for k, v := range query.Filters {
		h.Write([]byte(fmt.Sprintf("%s:%v", k, v)))
	}
	return fmt.Sprintf("search:%x", h.Sum(nil))
}

func (ds *DocumentationService) getRenderCacheKey(docID string, options *RenderOptions) string {
	h := sha256.New()
	h.Write([]byte(docID))
	if options != nil {
		h.Write([]byte(fmt.Sprintf("%+v", options)))
	}
	return fmt.Sprintf("render:%x", h.Sum(nil))
}

func (ds *DocumentationService) loadTemplates() {
	// Load built-in templates
	ds.templateEngine.New("api").Parse(apiTemplate)
	ds.templateEngine.New("guide").Parse(guideTemplate)
	ds.templateEngine.New("tutorial").Parse(tutorialTemplate)
	// ... more templates
}

func (ds *DocumentationService) loadTranslations() {
	// Load translations for different languages
	ds.translations["en"] = map[string]string{
		"quick_start":   "Quick Start",
		"api_reference": "API Reference",
		"examples":      "Examples",
		// ... more translations
	}

	ds.translations["es"] = map[string]string{
		"quick_start":   "Inicio Rápido",
		"api_reference": "Referencia de API",
		"examples":      "Ejemplos",
		// ... more translations
	}
}

func (ds *DocumentationService) startBackgroundTasks() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// Cleanup expired cache entries
			ds.cache.Cleanup()

			// Update analytics aggregates
			ds.analytics.UpdateAggregates()

			// Validate documents
			ds.validateAllDocuments()
		}
	}
}

func (ds *DocumentationService) validateAllDocuments() {
	ds.mu.RLock()
	documents := make([]*Document, 0, len(ds.documents))
	for _, doc := range ds.documents {
		documents = append(documents, doc)
	}
	ds.mu.RUnlock()

	for _, doc := range documents {
		if err := ds.validator.ValidateDocument(doc); err != nil {
			ds.logger.Warn("Document validation failed", "id", doc.ID, "error", err)
		}
	}
}

// Template constants
const apiTemplate = `
<!DOCTYPE html>
<html>
<head>
    <title>{{.Title}} - API Documentation</title>
    <link rel="stylesheet" href="/static/docs/api.css">
</head>
<body class="api-docs">
    <header>
        <h1>{{.Title}}</h1>
    </header>
    <main>
        {{range .Sections}}
        <section id="{{.Anchor}}">
            <h2>{{.Title}}</h2>
            {{.Content}}
        </section>
        {{end}}
    </main>
</body>
</html>
`

const guideTemplate = `
<!DOCTYPE html>
<html>
<head>
    <title>{{.Title}} - Guide</title>
    <link rel="stylesheet" href="/static/docs/guide.css">
</head>
<body class="guide-docs">
    <nav class="table-of-contents">
        {{.TableOfContents}}
    </nav>
    <main>
        <article>
            {{.Content}}
        </article>
    </main>
</body>
</html>
`

const tutorialTemplate = `
<!DOCTYPE html>
<html>
<head>
    <title>{{.Title}} - Tutorial</title>
    <link rel="stylesheet" href="/static/docs/tutorial.css">
</head>
<body class="tutorial-docs">
    <div class="tutorial-progress">
        {{.ProgressBar}}
    </div>
    <main>
        {{range .Steps}}
        <section class="tutorial-step" id="step-{{.Number}}">
            <h3>Step {{.Number}}: {{.Title}}</h3>
            <div class="step-content">{{.Content}}</div>
            {{if .CodeExample}}
            <div class="code-example">
                <pre><code>{{.CodeExample}}</code></pre>
            </div>
            {{end}}
        </section>
        {{end}}
    </main>
</body>
</html>
`
