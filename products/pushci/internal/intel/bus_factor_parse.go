package intel

import (
	"strings"
	"time"
)

// parseGitLog consumes COMMIT\x00<author>\x00<epoch>\n<file>\n... output.
// Separated from bus_factor.go so the CI 100-line rule holds for both.
func parseGitLog(raw string) map[string]AuthorDistribution {
	dist := map[string]AuthorDistribution{}
	var author string
	var ts time.Time
	for _, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "COMMIT\x00") {
			parts := strings.SplitN(line, "\x00", 3)
			if len(parts) < 3 {
				continue
			}
			author, ts = parts[1], unixFromDigits(parts[2])
			continue
		}
		if author != "" {
			addTouch(dist, line, author, ts)
		}
	}
	return dist
}

func unixFromDigits(s string) time.Time {
	var n int64
	for _, r := range s {
		if r < '0' || r > '9' {
			return time.Time{}
		}
		n = n*10 + int64(r-'0')
	}
	return time.Unix(n, 0)
}

func addTouch(dist map[string]AuthorDistribution, file, author string, ts time.Time) {
	d, ok := dist[file]
	if !ok {
		d = AuthorDistribution{Path: file, Authors: map[string]int{}}
	}
	d.Authors[author]++
	d.Total++
	if ts.After(d.LastTouched) {
		d.LastTouched = ts
	}
	d.BusFactor = len(d.Authors)
	dist[file] = d
}
