package api

import (
	"fmt"
	"strings"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func formatAliases(e domain.Entity) string {
	if len(e.Names) <= 1 {
		return ""
	}
	aliases := make([]string, 0, len(e.Names)-1)
	for _, n := range e.Names[1:] {
		aliases = append(aliases, n.Full)
	}
	return strings.Join(aliases, ";")
}

func formatDOB(dob *time.Time) string {
	if dob == nil {
		return ""
	}
	return dob.Format("2006-01-02")
}

func formatStringSlice(items []string) string {
	return strings.Join(items, ";")
}

func formatIdentifiers(ids []domain.Identifier) string {
	if len(ids) == 0 {
		return ""
	}
	pairs := make([]string, 0, len(ids))
	for _, id := range ids {
		pairs = append(pairs, fmt.Sprintf("%s=%s", id.Type, id.Value))
	}
	return strings.Join(pairs, ";")
}

func metadataString(md map[string]interface{}, key string) string {
	if v, ok := md[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}
