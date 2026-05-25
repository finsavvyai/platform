package intel

import "strings"

func parseRootCause(text string) *RootCause {
	rc := &RootCause{AIGenerated: true, Confidence: 0.8}
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		switch {
		case strings.HasPrefix(line, "CATEGORY:"):
			rc.Category = strings.TrimSpace(strings.TrimPrefix(line, "CATEGORY:"))
		case strings.HasPrefix(line, "SUMMARY:"):
			rc.Summary = strings.TrimSpace(strings.TrimPrefix(line, "SUMMARY:"))
		case strings.HasPrefix(line, "FILES:"):
			files := strings.TrimSpace(strings.TrimPrefix(line, "FILES:"))
			if files != "unknown" && files != "" {
				for _, f := range strings.Split(files, ",") {
					rc.AffectedFiles = append(rc.AffectedFiles, strings.TrimSpace(f))
				}
			}
		case strings.HasPrefix(line, "FIX:"):
			step := strings.TrimSpace(strings.TrimPrefix(line, "FIX:"))
			if step != "" {
				rc.FixSteps = append(rc.FixSteps, step)
			}
		}
	}
	if rc.Summary == "" {
		rc.Summary = text
		rc.Confidence = 0.5
	}
	return rc
}
