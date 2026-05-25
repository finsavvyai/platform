package ingestion

import (
	"regexp"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// nbctfRowRe grabs <td>Hebrew</td><td>English</td> pairs from the
// ASPX dump version of the seizure list (used only as a fallback
// when CSV parsing produced zero rows).
var nbctfRowRe = regexp.MustCompile(
	`<tr[^>]*>\s*<td[^>]*>([^<]+)</td>\s*<td[^>]*>([^<]*)</td>`,
)

func (p *NBCTFParser) parseHTML(data []byte) ([]domain.Entity, error) {
	matches := nbctfRowRe.FindAllSubmatch(data, -1)
	if len(matches) == 0 {
		return nil, nil
	}
	var entities []domain.Entity
	for i, m := range matches {
		if len(m) < 3 {
			continue
		}
		nameHeb := cleanHTML(string(m[1]))
		nameEng := cleanHTML(string(m[2]))
		if nameHeb == "" {
			continue
		}
		ent, err := buildNBCTFEntity(i, nameHeb, nameEng)
		if err != nil {
			continue
		}
		entities = append(entities, ent)
	}
	return entities, nil
}

// cleanHTML unescapes the three HTML entities the NBCTF page is
// known to emit. Anything richer goes through parseCSV's path.
func cleanHTML(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, "&nbsp;", " ")
	s = strings.ReplaceAll(s, "&amp;", "&")
	s = strings.ReplaceAll(s, "&#39;", "'")
	return s
}
