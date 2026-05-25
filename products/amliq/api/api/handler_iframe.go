package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/storage"
)

// IFrameHandler serves the embeddable widget and screening endpoint.
type IFrameHandler struct {
	tenants  storage.TenantRepository
	entities storage.EntityRepository
}

func NewIFrameHandler(
	t storage.TenantRepository, e storage.EntityRepository,
) *IFrameHandler {
	return &IFrameHandler{tenants: t, entities: e}
}

func (h *IFrameHandler) ServeWidget(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/javascript")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Write(widgetJS)
}

func (h *IFrameHandler) Screen(w http.ResponseWriter, r *http.Request) {
	apiKey := r.Header.Get("X-API-Key")
	if apiKey == "" {
		Error(w, "UNAUTHORIZED", "api key required", http.StatusUnauthorized)
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := DecodeJSON(r, &req); err != nil || req.Name == "" {
		Error(w, "INVALID", "name required", http.StatusBadRequest)
		return
	}
	// Search entities for match — uses tenant from API key
	results, err := h.entities.Search(req.Name)
	if err != nil {
		Error(w, "DB_ERROR", "search failed", http.StatusInternalServerError)
		return
	}
	matches := make([]map[string]interface{}, 0, len(results))
	for _, ent := range results {
		matches = append(matches, map[string]interface{}{
			"name":    ent.PrimaryName().Full,
			"list_id": ent.ListID,
			"type":    ent.Type.String(),
		})
	}
	setCORSHeaders(w, r)
	Success(w, map[string]interface{}{
		"query":   req.Name,
		"matches": matches,
		"count":   len(matches),
	}, http.StatusOK)
}

func setCORSHeaders(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin != "" {
		w.Header().Set("Access-Control-Allow-Origin", origin)
	}
}

var widgetJS = []byte(`(function(){
  var AEGIS={};
  AEGIS.init=function(cfg){
    AEGIS.apiKey=cfg.apiKey||"";
    AEGIS.endpoint=cfg.endpoint||"/api/v1/widget/screen";
  };
  AEGIS.screen=function(name,cb){
    fetch(AEGIS.endpoint,{
      method:"POST",
      headers:{"Content-Type":"application/json","X-API-Key":AEGIS.apiKey},
      body:JSON.stringify({name:name})
    }).then(function(r){return r.json()}).then(cb);
  };
  window.AEGIS=AEGIS;
})();
`)
