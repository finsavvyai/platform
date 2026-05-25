//go:build ignore

// Package memory provides BM25 keyword search for memory entries
package memory

import (
	"context"
	"math"
	"regexp"
	"strings"
	"unicode"

	"github.com/sirupsen/logrus"
)

// BM25Searcher implements keyword-based search using BM25 algorithm
type BM25Searcher struct {
	logger    *logrus.Logger
	k1        float64 // Term saturation parameter (1.2-2.0, default 1.5)
	b         float64 // Length normalization parameter (0.75 default)
	avgDocLen float64 // Average document length
	docCount  int     // Total number of documents
}

// NewBM25Searcher creates a new BM25 searcher
func NewBM25Searcher(logger *logrus.Logger) *BM25Searcher {
	return &BM25Searcher{
		logger:    logger,
		k1:        1.5,
		b:         0.75,
		avgDocLen: 100, // Will be computed dynamically
		docCount:  0,
	}
}

// documentStats holds precomputed statistics for a document
type documentStats struct {
	termFreqs map[string]int           // Term frequency map
	length    int                      // Document length in words
	url       string                   // Entry ID for lookup
}

// Search performs BM25 search on the provided entries
func (bm *BM25Searcher) Search(ctx context.Context, query string, entries []*MemoryEntry, limit int) ([]*MemorySearchResult, error) {
	if len(entries) == 0 {
		return []*MemorySearchResult{}, nil
	}

	// Tokenize query
	queryTerms := bm.tokenize(query)

	// Build document corpus
	corpus := make(map[string]*documentStats)
	for _, entry := range entries {
		corpus[entry.ID] = &documentStats{
			termFreqs: make(map[string]int),
			url:       entry.ID,
		}

		// Tokenize document
		words := bm.tokenize(entry.Content)
		corpus[entry.ID].length = len(words)

		// Compute term frequencies
		for _, word := range words {
			corpus[entry.ID].termFreqs[word]++
		}
	}

	// Calculate average document length
	totalLen := 0
	for _, doc := range corpus {
		totalLen += doc.length
	}
	avgDocLen := float64(totalLen) / float64(len(corpus))
	bm.avgDocLen = avgDocLen
	bm.docCount = len(corpus)

	// Calculate document frequency for each query term
	docFreq := make(map[string]int)
	for _, term := range queryTerms {
		for _, doc := range corpus {
			if _, exists := doc.termFreqs[term]; exists {
				docFreq[term]++
			}
		}
	}

	// Calculate BM25 score for each document
	results := make([]*MemorySearchResult, 0)

	for _, entry := range entries {
		doc := corpus[entry.ID]
		score := bm.calculateBM25(queryTerms, doc, docFreq)

		results = append(results, &MemorySearchResult{
			Entry:     *entry,
			Score:     score,
			BM25Score: score,
		})
	}

	// Sort by score descending
	bm.sortResults(results)

	if len(results) > limit {
		results = results[:limit]
	}

	return results, nil
}

// calculateBM25 computes the BM25 score for a document
func (bm *BM25Searcher) calculateBM25(queryTerms []string, doc *documentStats, docFreq map[string]int) float64 {
	var score float64

	docLen := float64(doc.length)
	idf := math.Log(float64(bm.docCount-docFreq[queryTerms[0]]+0.5) / float64(docFreq[queryTerms[0]]+0.5))

	for _, term := range queryTerms {
		tf := float64(doc.termFreqs[term])
		if tf == 0 {
			continue
		}

		// IDF for this term
		df := float64(docFreq[term])
		if df == 0 {
			continue
		}
		idf = math.Log(float64(bm.docCount-df+0.5) / float64(df+0.5))

		// BM25 formula
		numerator := tf * (bm.k1 + 1)
		denominator := tf + bm.k1*(1-bm.b+bm.b*(float64(doc.length)/bm.avgDocLen))

		score += idf * (numerator / denominator)
	}

	return score
}

// tokenize splits text into individual words (lowercase, alphanumeric)
func (bm *BM25Searcher) tokenize(text string) []string {
	// Convert to lowercase
	text = strings.ToLower(text)

	// Extract alphanumeric words
	re := regexp.MustCompile(`[a-z0-9]+`)
	words := re.FindAllString(text, -1)

	// Filter very short words
	var result []string
	for _, word := range words {
		if len(word) > 2 {
			result = append(result, word)
		}
	}

	return result
}

// sortResults sorts results by score descending
func (bm *BM25Searcher) sortResults(results []*MemorySearchResult) {
	n := len(results)
	for i := 0; i < n-1; i++ {
		for j := 0; j < n-i-1; j++ {
			if results[j].Score < results[j+1].Score {
				results[j], results[j+1] = results[j+1], results[j]
			}
		}
	}
}

// InverseDocumentFrequency calculates IDF for a term across documents
func (bm *BM25Searcher) InverseDocumentFrequency(term string, docs []*MemoryEntry) float64 {
	count := 0
	for _, doc := range docs {
		words := bm.tokenize(doc.Content)
		for _, word := range words {
			if word == term {
				count++
				break
			}
		}
	}

	if count == 0 {
		return 0
	}

	return math.Log(float64(len(docs)-count+0.5) / float64(count+0.5)
}

// TermFrequency calculates TF for a term in a document
func (bm *BM25Searcher) TermFrequency(term, document string) float64 {
	words := bm.tokenize(document)
	if len(words) == 0 {
		return 0
	}

	count := 0
	for _, word := range words {
		if word == term {
			count++
		}
	}

	return float64(count) / float64(len(words))
}

// normalizeLowercase normalizes text for comparison
func normalizeLowercase(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

// IsStopWord checks if a word is a stop word (common words with little semantic value)
func IsStopWord(word string) bool {
	stopWords := map[string]bool{
		"a", "an", "and", "are", "as", "at", "be", "but", "by",
		"for", "if", "in", "into", "is", "it", "no", "not",
		"of", "on", "or", "such", "that", "the", "their", "then",
		"there", "these", "they", "this", "to", "was", "will", "with",
		// Common programming terms
		"the", "a", "an", "is", "are", "was", "were", "be", "been",
		"have", "has", "had", "do", "does", "did", "will", "would",
		"could", "should", "may", "might", "can", "shall",
	}
	return stopWords[normalizeLowercase(word)]
}

// ExtractKeywords extracts important keywords from text
func ExtractKeywords(text string, maxKeywords int) []string {
	bm := &BM25Searcher{}
	words := bm.tokenize(text)

	// Count frequency
	freq := make(map[string]int)
	for _, word := range words {
		if !IsStopWord(word) {
			freq[word]++
		}
	}

	// Sort by frequency
	type wordFreq struct {
		word  string
		count int
	}
	var sorted []wordFreq
	for word, count := range freq {
		sorted = append(sorted, wordFreq{word, count})
	}

	// Simple sort
	for i := 0; i < len(sorted)-1; i++ {
		for j := i + 1; j < len(sorted); j++ {
			if sorted[j].count > sorted[i].count {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}

	// Extract top keywords
	result := make([]string, 0, min(maxKeywords, len(sorted)))
	for i, wf := range sorted {
		if i >= maxKeywords {
			break
		}
		result = append(result, wf.word)
	}

	return result
}

// CosineSimilarity calculates cosine similarity between two text documents
func CosineSimilarity(text1, text2 string) float64 {
	bm := &BM25Searcher{}
	vec1 := bm.textToVector(text1)
	vec2 := bm.textToVector(text2)

	return dotProduct(vec1, vec2) / (magnitude(vec1) * magnitude(vec2))
}

func dotProduct(a, b map[string]float64) float64 {
	var sum float64
	for key, valA := range a {
		if valB, exists := b[key]; exists {
			sum += valA * valB
		}
	}
	return sum
}

func magnitude(v map[string]float64) float64 {
	var sum float64
	for _, val := range v {
		sum += val * val
	}
	return math.Sqrt(sum)
}

func (bm *BM25Searcher) textToVector(text string) map[string]float64 {
	words := bm.tokenize(text)
	vec := make(map[string]float64)

	maxFreq := 0
	freq := make(map[string]int)
	for _, word := range words {
		freq[word]++
		if freq[word] > maxFreq {
			maxFreq = freq[word]
		}
	}

	for word, count := range freq {
		vec[word] = float64(count) / float64(maxFreq)
	}

	return vec
}

// RelevanceScore calculates a relevance score for a search query against a document
// Combines multiple factors: exact phrase match, keyword density, position
func RelevanceScore(query, document string) float64 {
	bm := &BM25Searcher{}
	queryTerms := bm.tokenize(query)
	docTerms := bm.tokenize(document)

	if len(queryTerms) == 0 {
		return 0
	}

	// Exact phrase bonus
	phraseBonus := 0.0
	lowerDoc := strings.ToLower(document)
	lowerQuery := strings.ToLower(query)
	if strings.Contains(lowerDoc, lowerQuery) {
		phraseBonus = 0.3
	}

	// Query term coverage
	coverage := 0
	covered := make(map[string]bool)
	for _, term := range queryTerms {
		for _, docTerm := range docTerms {
			if term == docTerm {
				covered[term] = true
				break
			}
		}
	}
	coverage = int(float64(len(covered)) / float64(len(queryTerms)) * 100)

	// Early in document bonus (first 20%)
	positionBonus := 0.0
	if len(docTerms) > 0 {
		for i, docTerm := range docTerms {
			for _, queryTerm := range queryTerms {
				if docTerm == queryTerm && float64(i) < float64(len(docTerms))*0.2 {
					positionBonus = 0.2
					break
				}
			}
		}
	}

	return phraseBonus + float64(coverage)/100.0 + positionBonus
}
