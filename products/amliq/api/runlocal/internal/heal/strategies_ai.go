package heal

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/finsavvyai/pushci/internal/ai"
)

const aiSystem = `You are a CI/CD self-healing agent.
Given a failed check's output and relevant source files,
return EXACTLY one fix. Use this format:

FILE: <relative path>
PATCH:
<full corrected file content>

If the fix is a command instead, use:
CMD: <shell command to run>

Be concise. No explanation needed.`

// aiFix asks Claude to generate a fix for a failure.
func aiFix(ctx context.Context, client *ai.Client, check, output, root string) *Fix {
	prompt := buildAIPrompt(check, output, root)
	text, err := client.AskWithSystem(ctx, aiSystem, prompt)
	if err != nil {
		return nil
	}
	return parseAIResponse(text)
}

func buildAIPrompt(check, output, root string) string {
	src := gatherContext(root)
	return fmt.Sprintf("Check: %s\nOutput:\n%s\n\nSource files:\n%s",
		check, truncate(output, 1200), src)
}

func gatherContext(root string) string {
	var b strings.Builder
	exts := []string{"*.go", "*.ts", "*.py", "*.js", "*.json"}
	for _, ext := range exts {
		matches, _ := filepath.Glob(filepath.Join(root, ext))
		for _, m := range matches {
			data, err := os.ReadFile(m)
			if err != nil || len(data) > 3000 {
				continue
			}
			rel, _ := filepath.Rel(root, m)
			fmt.Fprintf(&b, "--- %s ---\n%s\n", rel, data)
			if b.Len() > 6000 {
				return b.String()
			}
		}
	}
	return b.String()
}

func parseAIResponse(text string) *Fix {
	for _, line := range strings.Split(text, "\n") {
		if strings.HasPrefix(line, "CMD:") {
			return &Fix{Pattern: "ai-cmd", Action: strings.TrimSpace(strings.TrimPrefix(line, "CMD:"))}
		}
	}
	return parseFilePatch(text)
}

func parseFilePatch(text string) *Fix {
	idx := strings.Index(text, "FILE:")
	if idx < 0 {
		return nil
	}
	rest := text[idx+5:]
	lines := strings.SplitN(rest, "\n", 2)
	if len(lines) < 2 {
		return nil
	}
	file := strings.TrimSpace(lines[0])
	patchIdx := strings.Index(lines[1], "PATCH:")
	if patchIdx < 0 {
		return nil
	}
	content := strings.TrimSpace(lines[1][patchIdx+6:])
	return &Fix{
		Pattern:      "ai-patch",
		Action:       "write:" + file,
		FilesChanged: []string{file + "=" + content},
	}
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[len(s)-max:]
}
