package handlers

import (
	"fmt"
	"html"
	"net/http"
	"strings"
)

// OGCardSVG serves /api/v1/og/{name}.svg — a 1200x630 social-share card
// rendered at request time with live finding counts. Twitter/LinkedIn/Slack
// render SVG OG images directly; pages set <meta property="og:image"> to
// this URL to get a per-scan share preview.
func (h *Handlers) OGCardSVG(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/api/v1/og/"), ".svg")
	if name == "" {
		http.NotFound(w, r)
		return
	}

	stats := readStats(h)
	svg := renderOGCard(name, stats)

	w.Header().Set("Content-Type", "image/svg+xml; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=300")
	_, _ = w.Write([]byte(svg))
}

type ogStats struct {
	critical, high, medium, low, open int
}

func readStats(h *Handlers) ogStats {
	if h == nil || h.db == nil {
		return ogStats{}
	}
	s, err := h.db.GetFindingStats()
	if err != nil {
		return ogStats{}
	}
	return ogStats{
		critical: s["critical"],
		high:     s["high"],
		medium:   s["medium"],
		low:      s["low"],
		open:     s["open"],
	}
}

func renderOGCard(target string, s ogStats) string {
	headline, accent := ogHeadline(s)
	safeTarget := html.EscapeString(target)
	return fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#0a0e1a"/>
    <stop offset="1" stop-color="#11192e"/>
  </linearGradient>
</defs>
<rect width="1200" height="630" fill="url(#bg)"/>
<rect x="60" y="540" width="1080" height="6" fill="%s" rx="3"/>
<text x="60" y="120" fill="#9ca3af" font-size="28" font-weight="500" letter-spacing="2">PIPEWARDEN</text>
<text x="60" y="220" fill="#fff" font-size="68" font-weight="700">%s</text>
<text x="60" y="285" fill="#cbd5e1" font-size="34" font-weight="500">%s</text>
%s
<text x="60" y="595" fill="#64748b" font-size="22">pipewarden.com · CI/CD pipeline security across 6 platforms</text>
</svg>`,
		accent,
		headline,
		safeTarget,
		ogStatsRow(s),
	)
}

func ogHeadline(s ogStats) (string, string) {
	switch {
	case s.critical > 0:
		return fmt.Sprintf("%d critical finding%s", s.critical, plural(s.critical)), "#e5484d"
	case s.high > 0:
		return fmt.Sprintf("%d high-severity finding%s", s.high, plural(s.high)), "#f5a524"
	case s.medium > 0:
		return fmt.Sprintf("%d medium finding%s", s.medium, plural(s.medium)), "#f5d524"
	case s.open > 0:
		return fmt.Sprintf("%d open finding%s", s.open, plural(s.open)), "#3ddc97"
	default:
		return "Pipeline passing", "#3ddc97"
	}
}

func ogStatsRow(s ogStats) string {
	cells := []struct {
		label string
		count int
		color string
	}{
		{"Critical", s.critical, "#e5484d"},
		{"High", s.high, "#f5a524"},
		{"Medium", s.medium, "#f5d524"},
		{"Low", s.low, "#3ddc97"},
	}
	var b strings.Builder
	x := 60
	for _, c := range cells {
		fmt.Fprintf(&b,
			`<g><text x="%d" y="430" fill="%s" font-size="72" font-weight="700">%d</text>`+
				`<text x="%d" y="475" fill="#94a3b8" font-size="22" font-weight="500" letter-spacing="1">%s</text></g>`,
			x, c.color, c.count, x, strings.ToUpper(c.label),
		)
		x += 270
	}
	return b.String()
}

func plural(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}
