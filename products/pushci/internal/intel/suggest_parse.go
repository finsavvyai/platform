package intel

import "strings"

func parsePRResponse(text string) *PRSuggestion {
	pr := &PRSuggestion{}
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		switch {
		case strings.HasPrefix(line, "TITLE:"):
			pr.Title = strings.TrimSpace(strings.TrimPrefix(line, "TITLE:"))
		case strings.HasPrefix(line, "DESCRIPTION:"):
			pr.Description = strings.TrimSpace(strings.TrimPrefix(line, "DESCRIPTION:"))
		case strings.HasPrefix(line, "CMD:"):
			cmd := strings.TrimSpace(strings.TrimPrefix(line, "CMD:"))
			if cmd != "" {
				pr.FixCommands = append(pr.FixCommands, cmd)
			}
		case strings.HasPrefix(line, "PATCH:"):
			pr.FilePatch = strings.TrimSpace(strings.TrimPrefix(line, "PATCH:"))
		}
	}
	return pr
}
