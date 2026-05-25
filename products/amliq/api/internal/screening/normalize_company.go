package screening

import "strings"

// companyStopWords lists common corporate suffixes/stop words to strip.
var companyStopWords = map[string]bool{
	"ltd":           true,
	"limited":       true,
	"corp":          true,
	"corporation":   true,
	"inc":           true,
	"incorporated":  true,
	"llc":           true,
	"gmbh":          true,
	"ag":            true,
	"sa":            true,
	"plc":           true,
	"co":            true,
	"company":       true,
	"group":         true,
	"holding":       true,
	"holdings":      true,
	"international": true,
	"intl":          true,
	"industries":    true,
	"of":            true,
	"the":           true,
	"and":           true,
}

// NormalizeCompany strips corporate stop words and normalizes spacing.
func NormalizeCompany(name string) string {
	name = strings.ToLower(strings.TrimSpace(name))
	name = stripCompanyPunctuation(name)
	tokens := strings.Fields(name)
	var kept []string
	for _, t := range tokens {
		if !companyStopWords[t] {
			kept = append(kept, t)
		}
	}
	return strings.Join(kept, " ")
}

// IsCompanyStopWord returns true if the word is a corporate stop word.
func IsCompanyStopWord(word string) bool {
	return companyStopWords[strings.ToLower(strings.TrimSpace(word))]
}

// CompanyWeight returns 0.1 for stop words, 1.0 for normal words.
func CompanyWeight(word string) float64 {
	if IsCompanyStopWord(word) {
		return 0.1
	}
	return 1.0
}

func stripCompanyPunctuation(s string) string {
	replacer := strings.NewReplacer(
		".", "", ",", "", "-", " ", "'", "", "\"", "",
		"(", "", ")", "",
	)
	return replacer.Replace(s)
}
