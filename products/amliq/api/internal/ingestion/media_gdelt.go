package ingestion

import (
	"bufio"
	"bytes"
	"strings"
	"time"
)

// GDELTArticle represents a parsed GDELT record.
type GDELTArticle struct {
	URL         string
	Title       string
	Source      string
	PublishedAt time.Time
	Themes      []string
	Persons     []string
	Orgs        []string
	Tone        string
	Country     string
}

// AML-relevant GDELT theme prefixes.
var amlThemes = []string{
	"CRIME", "CORRUPTION", "FRAUD", "TERROR", "SANCTIONS",
	"MONEY_LAUNDERING", "TAX_EVASION", "TRAFFICKING",
}

// GDELTParser extracts AML-relevant articles from GDELT TSV exports.
type GDELTParser struct{}

func NewGDELTParser() *GDELTParser { return &GDELTParser{} }

// Parse reads GDELT GKG TSV data and returns AML-relevant articles.
func (p *GDELTParser) Parse(data []byte) []GDELTArticle {
	var articles []GDELTArticle
	scanner := bufio.NewScanner(bytes.NewReader(data))
	for scanner.Scan() {
		if article, ok := p.parseLine(scanner.Text()); ok {
			articles = append(articles, article)
		}
	}
	return articles
}

func (p *GDELTParser) parseLine(line string) (GDELTArticle, bool) {
	fields := strings.Split(line, "\t")
	if len(fields) < 15 {
		return GDELTArticle{}, false
	}
	themes := splitSemicolon(fields[3])
	if !hasAMLTheme(themes) {
		return GDELTArticle{}, false
	}
	return GDELTArticle{
		URL:     fields[4],
		Source:  extractDomain(fields[4]),
		Title:   fields[2],
		Themes:  themes,
		Persons: splitSemicolon(fields[6]),
		Orgs:    splitSemicolon(fields[7]),
		Tone:    fields[9],
		Country: fields[10],
	}, true
}

func hasAMLTheme(themes []string) bool {
	for _, t := range themes {
		for _, aml := range amlThemes {
			if strings.HasPrefix(strings.ToUpper(t), aml) {
				return true
			}
		}
	}
	return false
}

func splitSemicolon(s string) []string {
	if s == "" {
		return nil
	}
	return strings.Split(s, ";")
}

func extractDomain(url string) string {
	url = strings.TrimPrefix(url, "https://")
	url = strings.TrimPrefix(url, "http://")
	if idx := strings.Index(url, "/"); idx > 0 {
		return url[:idx]
	}
	return url
}
