package ingestion

import "fmt"

const sparqlEndpoint = "https://query.wikidata.org/sparql"

// pepQuery returns SPARQL to find all PEPs for a country Q-number.
func pepQuery(countryQID string) string {
	return fmt.Sprintf(`SELECT ?person ?personLabel ?position ?positionLabel
  ?countryLabel ?dob ?spouse ?spouseLabel WHERE {
  ?person wdt:P39 ?position.
  ?position wdt:P31/wdt:P279* wd:Q4164871.
  ?person wdt:P27 wd:%s.
  OPTIONAL { ?person wdt:P569 ?dob. }
  OPTIONAL { ?person wdt:P26 ?spouse. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 10000`, countryQID)
}

// rcaQuery returns SPARQL to find family members of a PEP.
func rcaQuery(pepQID string) string {
	return fmt.Sprintf(`SELECT ?relative ?relativeLabel ?relType WHERE {
  { wd:%s wdt:P26 ?relative. BIND("spouse" AS ?relType) }
  UNION { wd:%s wdt:P40 ?relative. BIND("child" AS ?relType) }
  UNION { wd:%s wdt:P22 ?relative. BIND("father" AS ?relType) }
  UNION { wd:%s wdt:P25 ?relative. BIND("mother" AS ?relType) }
  UNION { wd:%s wdt:P3373 ?relative. BIND("sibling" AS ?relType) }
  UNION { wd:%s wdt:P451 ?relative. BIND("partner" AS ?relType) }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`, pepQID, pepQID, pepQID, pepQID, pepQID, pepQID)
}

// soeQuery returns SPARQL to find state-owned enterprises for a country.
func soeQuery(countryQID string) string {
	return fmt.Sprintf(`SELECT ?org ?orgLabel ?ownerLabel WHERE {
  ?org wdt:P127 ?owner.
  { ?owner wdt:P31/wdt:P279* wd:Q7188. }
  UNION { ?owner wdt:P31 wd:Q3624078. }
  ?org wdt:P17 wd:%s.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 5000`, countryQID)
}

// extractQID extracts the Q-number from a Wikidata entity URI.
// e.g. "http://www.wikidata.org/entity/Q42" -> "Q42"
func extractQID(uri string) string {
	if uri == "" {
		return ""
	}
	for i := len(uri) - 1; i >= 0; i-- {
		if uri[i] == '/' {
			return uri[i+1:]
		}
	}
	return uri
}
