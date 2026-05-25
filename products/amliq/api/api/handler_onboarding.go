package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
)

func handleSuggestedLists(w http.ResponseWriter, req *http.Request) {
	country := req.URL.Query().Get("country")
	if country == "" {
		country = "US"
	}

	lists := domain.SuggestedLists(country)
	items := make([]map[string]interface{}, len(lists))
	for i, l := range lists {
		items[i] = map[string]interface{}{
			"list_id":       l.ListID,
			"source_url":    l.SourceURL,
			"parser_type":   l.ParserType,
			"sync_schedule": l.SyncSchedule,
			"sync_enabled":  l.SyncEnabled,
			"threshold":     l.Threshold,
		}
	}
	Success(w, map[string]interface{}{"lists": items}, http.StatusOK)
}
