package api

import (
	"encoding/json"
	"net/http"
	"os"

	"gopkg.in/yaml.v3"
)

// DocsHandler serves OpenAPI spec and Swagger UI.
type DocsHandler struct {
	specPath string
}

func NewDocsHandler(specPath string) *DocsHandler {
	return &DocsHandler{specPath: specPath}
}

func (dh *DocsHandler) ServeSpec(w http.ResponseWriter, r *http.Request) {
	data, err := os.ReadFile(dh.specPath)
	if err != nil {
		Error(w, "NOT_FOUND", "spec not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/yaml")
	w.Write(data)
}

func (dh *DocsHandler) ServeSpecJSON(w http.ResponseWriter, r *http.Request) {
	data, err := os.ReadFile(dh.specPath)
	if err != nil {
		Error(w, "NOT_FOUND", "spec not found", http.StatusNotFound)
		return
	}
	var spec interface{}
	if err := yaml.Unmarshal(data, &spec); err != nil {
		Error(w, "PARSE_ERROR", "failed to parse spec", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(spec)
}

func (dh *DocsHandler) ServeSwaggerUI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(swaggerHTML))
}

const swaggerHTML = `<!DOCTYPE html>
<html><head>
<title>AEGIS API Docs</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css">
</head><body>
<div id="swagger-ui"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js"></script>
<script>
SwaggerUIBundle({url:"/docs/openapi.yaml",dom_id:"#swagger-ui"});
</script>
</body></html>`
