package ingestion

// sparqlResponse represents the JSON response from Wikidata SPARQL.
type sparqlResponse struct {
	Results sparqlResults `json:"results"`
}

type sparqlResults struct {
	Bindings []sparqlBinding `json:"bindings"`
}

// sparqlBinding is a single result row from SPARQL.
type sparqlBinding map[string]sparqlValue

type sparqlValue struct {
	Type  string `json:"type"`
	Val   string `json:"value"`
	Lang  string `json:"xml:lang,omitempty"`
	DType string `json:"datatype,omitempty"`
}

// Value returns the string value of a binding variable, or empty.
func (b sparqlBinding) Value(key string) string {
	if v, ok := b[key]; ok {
		return v.Val
	}
	return ""
}
