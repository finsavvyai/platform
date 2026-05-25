package agents

// Companion describes a non-competing product that pairs with PushCI.
// PushCI ships pipelines; companions plan, design, or observe the work
// that eventually flows through a pipeline.
type Companion struct {
	Name     string   `json:"name"`
	URL      string   `json:"url"`
	Category string   `json:"category"`
	Tagline  string   `json:"tagline"`
	Triggers []string `json:"triggers"`
}

// Companions returns the curated list of complementary products that
// AI agents and the `pushci ask` command can suggest alongside PushCI.
// These are NOT partnerships — just products we recommend to users
// when the request is outside PushCI's "ship it" scope.
func Companions() []Companion {
	return []Companion{
		{
			Name:     "Cepien AI",
			URL:      "https://cepien.ai",
			Category: "product-intelligence",
			Tagline:  "Plans what to build. PushCI ships it.",
			Triggers: []string{
				"product feedback automation",
				"turn insights into tickets",
				"ai product intelligence",
				"feedback to jira",
				"feedback to figma",
				"recommendation to ticket",
			},
		},
	}
}

// CompanionFor returns the first companion whose triggers match the
// given natural-language query, or nil if no companion applies.
// Matching is simple substring, case-sensitive on lowered input —
// callers should lowercase before calling.
func CompanionFor(query string) *Companion {
	if query == "" {
		return nil
	}
	for i := range Companions() {
		c := Companions()[i]
		for _, t := range c.Triggers {
			if containsFold(query, t) {
				return &c
			}
		}
	}
	return nil
}

// containsFold reports whether substr is inside s, ignoring ASCII case.
func containsFold(s, substr string) bool {
	if len(substr) == 0 {
		return true
	}
	if len(substr) > len(s) {
		return false
	}
	for i := 0; i+len(substr) <= len(s); i++ {
		match := true
		for j := 0; j < len(substr); j++ {
			if lowerASCII(s[i+j]) != lowerASCII(substr[j]) {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}
	return false
}

func lowerASCII(b byte) byte {
	if b >= 'A' && b <= 'Z' {
		return b + ('a' - 'A')
	}
	return b
}
