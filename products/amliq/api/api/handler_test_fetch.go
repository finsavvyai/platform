package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/ingestion"
)

// TestFetchHandler provides a diagnostic endpoint to verify
// connectivity to Israeli government sanctions sources.
type TestFetchHandler struct{}

func NewTestFetchHandler() *TestFetchHandler {
	return &TestFetchHandler{}
}

type fetchResult struct {
	Name    string `json:"name"`
	URL     string `json:"url"`
	Status  string `json:"status"`
	Bytes   int    `json:"bytes"`
	Elapsed string `json:"elapsed"`
	Error   string `json:"error,omitempty"`
	Preview string `json:"preview,omitempty"`
}

// TestIsraeliSources tries to fetch each Israeli gov source and
// reports results. GET /api/v1/admin/ops/test-fetch
func (h *TestFetchHandler) TestIsraeliSources(
	w http.ResponseWriter, r *http.Request,
) {
	sources := []struct{ name, url string }{
		{"NBCTF Orgs CSV", ingestion.NBCTFOrgsURL},
		{"NBCTF Individuals CSV", ingestion.NBCTFIndividualsURL},
		{"NBCTF Orgs XML", ingestion.NBCTFOrgsXML},
		{"NBCTF Individuals XML", ingestion.NBCTFIndividualsXML},
		{"Israeli Treasury XLSX", ingestion.IsraeliTreasuryURL},
		{"NBCTF Blockchain", "https://nbctf.mod.gov.il/he/" +
			"MinisterSanctions/PropertyPerceptions/" +
			"Pages/Blockchain.aspx"},
	}

	var results []fetchResult
	for _, src := range sources {
		start := time.Now()
		data, err := ingestion.FetchIsraeliGov(src.url)
		elapsed := time.Since(start)

		res := fetchResult{
			Name:    src.name,
			URL:     src.url,
			Elapsed: elapsed.Round(time.Millisecond).String(),
		}
		if err != nil {
			res.Status = "FAIL"
			res.Error = err.Error()
		} else {
			res.Status = "OK"
			res.Bytes = len(data)
			if len(data) > 200 {
				res.Preview = string(data[:200])
			} else {
				res.Preview = string(data)
			}
		}
		results = append(results, res)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"results": results,
		"total":   len(results),
	})
}
