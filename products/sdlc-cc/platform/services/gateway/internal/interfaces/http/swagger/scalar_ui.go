package swagger

// CustomSwaggerUI returns the HTML page that renders the API reference using
// Scalar (https://github.com/scalar/scalar). The function name is preserved
// for backwards compatibility with existing callers and tests.
//
// Scalar is loaded from the jsdelivr CDN and points at /openapi.yaml served
// by SetupRoutes. The HeyGen dark theme (deepSpace) matches the rest of the
// SDLC admin surface.
func CustomSwaggerUI(config SwaggerConfig) string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>` + config.Title + ` Documentation</title>
  <link rel="icon" href="/favicon.ico">
  <style>
    html, body { margin: 0; padding: 0; background: #0a0a0f; color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      "Helvetica Neue", Arial, sans-serif; }
    .sdlc-banner { background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
      border-bottom: 1px solid rgba(102,126,234,0.3); padding: 1.25rem 2rem; }
    .sdlc-banner h1 { margin: 0; font-size: 1.25rem; color: #a0a0ff;
      font-weight: 600; letter-spacing: 0.02em; }
    .sdlc-banner p { margin: 0.25rem 0 0; color: rgba(226,232,240,0.7);
      font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="sdlc-banner">
    <h1>` + config.Title + `</h1>
    <p>` + config.Description + ` — powered by Scalar</p>
  </div>
  <script
    id="api-reference"
    data-url="/openapi.yaml"
    data-configuration='` + scalarConfigJSON(config) + `'></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`
}

// scalarConfigJSON builds the Scalar configuration attribute value.
// Scalar accepts a JSON-encoded configuration object via data-configuration.
func scalarConfigJSON(config SwaggerConfig) string {
	return `{` +
		`"theme":"deepSpace",` +
		`"darkMode":true,` +
		`"layout":"modern",` +
		`"hideDownloadButton":false,` +
		`"hideModels":false,` +
		`"showSidebar":true,` +
		`"searchHotKey":"k",` +
		`"metaData":{` +
		`"title":"` + jsAttrEscape(config.Title) + `",` +
		`"description":"` + jsAttrEscape(config.Description) + `"` +
		`},` +
		`"defaultHttpClient":{"targetKey":"shell","clientKey":"curl"}` +
		`}`
}

// jsAttrEscape escapes characters that would break a single-quoted HTML
// attribute value when embedding user-supplied strings into the Scalar
// data-configuration JSON blob.
func jsAttrEscape(s string) string {
	out := make([]rune, 0, len(s))
	for _, r := range s {
		switch r {
		case '\'':
			out = append(out, '\\', '\'')
		case '"':
			out = append(out, '\\', '"')
		case '\\':
			out = append(out, '\\', '\\')
		case '\n', '\r':
			out = append(out, ' ')
		default:
			out = append(out, r)
		}
	}
	return string(out)
}
