package nlp

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/finsavvyai/pushci/internal/ai"
	"github.com/finsavvyai/pushci/internal/detect"
)

// RepoContext describes the current repository state.
type RepoContext struct {
	Root     string
	Projects []detect.Project
	Branch   string
	LastRun  string // "passed", "failed", or ""
}

// Action is the parsed intent from a natural language command.
type Action struct {
	Type   string            `json:"type"`
	Params map[string]string `json:"params"`
}

// Interpreter translates natural language into CI/CD actions.
type Interpreter struct {
	client *ai.Client
}

// NewInterpreter creates an interpreter with the given AI client.
func NewInterpreter(client *ai.Client) *Interpreter {
	return &Interpreter{client: client}
}

// Interpret sends user input to Claude and returns a parsed Action.
func (i *Interpreter) Interpret(ctx context.Context, input string, rc RepoContext) (*Action, error) {
	// Fast path: try pattern matching first (no AI call)
	if action := matchPattern(input); action != nil {
		return action, nil
	}
	if !i.client.IsConfigured() {
		return nil, fmt.Errorf("ANTHROPIC_API_KEY not set; cannot interpret: %s", input)
	}
	prompt := buildNLPPrompt(input, rc)
	text, err := i.client.AskWithSystem(ctx, SystemPrompt, prompt)
	if err != nil {
		return nil, fmt.Errorf("interpret: %w", err)
	}
	return parseResponse(text)
}

func buildNLPPrompt(input string, rc RepoContext) string {
	var stacks []string
	for _, p := range rc.Projects {
		stacks = append(stacks, fmt.Sprintf("%s (%s)", p.Stack, p.Dir))
	}
	return fmt.Sprintf("Repository: %s\nBranch: %s\nProjects: %s\nLast run: %s\n\nUser: %s",
		rc.Root, rc.Branch, strings.Join(stacks, ", "), rc.LastRun, input)
}

func parseResponse(text string) (*Action, error) {
	// Try to extract JSON from the response
	start := strings.Index(text, "{")
	end := strings.LastIndex(text, "}")
	if start >= 0 && end > start {
		var action Action
		if err := json.Unmarshal([]byte(text[start:end+1]), &action); err == nil {
			if action.Type != "" {
				return &action, nil
			}
		}
	}
	return &Action{Type: "status", Params: map[string]string{"raw": text}}, nil
}
