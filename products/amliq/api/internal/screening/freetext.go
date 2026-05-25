package screening

import (
	"context"
	"regexp"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// FreeTextScanner extracts names from free text and screens each.
type FreeTextScanner struct {
	engine *Engine
}

// NewFreeTextScanner creates a scanner with the screening engine.
func NewFreeTextScanner(engine *Engine) *FreeTextScanner {
	return &FreeTextScanner{engine: engine}
}

// FreeTextResult holds one extracted name and its screening result.
type FreeTextResult struct {
	ExtractedName string               `json:"extracted_name"`
	Position      int                  `json:"position"`
	Matches       []domain.MatchResult `json:"matches"`
	RiskLevel     string               `json:"risk_level"`
}

// Scan extracts names from text and screens each against sanctions.
func (s *FreeTextScanner) Scan(
	ctx context.Context, text string, candidates []domain.Entity,
) ([]FreeTextResult, error) {
	names := ExtractNames(text)
	var results []FreeTextResult

	for _, n := range names {
		query := buildDemoEntity(n.Name)
		matches, err := s.engine.Screen(query, candidates)
		if err != nil {
			continue
		}
		if len(matches) == 0 {
			continue
		}
		risk := "LOW"
		if len(matches) > 0 && matches[0].Confidence.Score() > 0.8 {
			risk = "HIGH"
		} else if len(matches) > 0 && matches[0].Confidence.Score() > 0.5 {
			risk = "MEDIUM"
		}
		results = append(results, FreeTextResult{
			ExtractedName: n.Name,
			Position:      n.Position,
			Matches:       matches,
			RiskLevel:     risk,
		})
	}
	return results, nil
}

func buildDemoEntity(name string) domain.Entity {
	id, _ := domain.NewEntityID("ent_query000000")
	n, _ := domain.NewName(name, "", "", "")
	e, _ := domain.NewEntity(id, domain.EntityTypeIndividual, []domain.Name{n})
	return e
}

// NameSpan is an extracted name with its position in text.
type NameSpan struct {
	Name     string
	Position int
}

var titleCase = regexp.MustCompile(`[A-Z][a-z]+`)

// sentenceSplitter is package-level so ExtractNames doesn't pay a
// regex compilation + allocation on every call (hot path via
// adverse-media scans).
var sentenceSplitter = regexp.MustCompile(`[.!?]+\s+`)

// ExtractNames finds potential person/org names in free text.
func ExtractNames(text string) []NameSpan {
	var spans []NameSpan
	seen := map[string]bool{}
	// Split on sentence boundaries first
	sentences := sentenceSplitter.Split(text, -1)
	for _, sentence := range sentences {
		words := strings.Fields(sentence)
		for i := 0; i < len(words); i++ {
			w := cleanWord(words[i])
			if !startsUpper(w) || len(w) < 2 || isCommonWord(strings.ToLower(w)) {
				continue
			}
			name := w
			pos := strings.Index(text, words[i])
			for j := i + 1; j < len(words) && j < i+5; j++ {
				nw := cleanWord(words[j])
				if !startsUpper(nw) && !isConnector(nw) {
					break
				}
				if endsWithPunct(words[j]) {
					name += " " + nw
					i = j
					break
				}
				name += " " + nw
				i = j
			}
			name = strings.TrimSpace(name)
			lower := strings.ToLower(name)
			if len(name) < 3 || seen[lower] || isCommonWord(lower) {
				continue
			}
			seen[lower] = true
			spans = append(spans, NameSpan{Name: name, Position: pos})
		}
	}
	return spans
}

func endsWithPunct(w string) bool {
	if len(w) == 0 {
		return false
	}
	last := w[len(w)-1]
	return last == '.' || last == ',' || last == ';' || last == ':'
}
