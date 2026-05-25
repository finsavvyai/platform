package agents

import (
	"fmt"
	"strings"
)

// PipelineEvolution tracks how a pipeline changes over time.
type PipelineEvolution struct {
	Suggestions []EvolveSuggestion
}

// EvolveSuggestion is a proposed pipeline improvement.
type EvolveSuggestion struct {
	Check   string `json:"check"`
	Action  string `json:"action"` // add_cache, parallelize, remove, reorder
	Reason  string `json:"reason"`
	Savings string `json:"savings"`
}

// EvolvePipeline analyzes a pipeline YAML and suggests improvements.
func EvolvePipeline(config string) *PipelineEvolution {
	ev := &PipelineEvolution{}
	if !strings.Contains(config, "cache") {
		ev.Suggestions = append(ev.Suggestions, EvolveSuggestion{
			Check:   "dependencies",
			Action:  "add_cache",
			Reason:  "No caching detected — cache dependencies to save time",
			Savings: "30-60% faster installs",
		})
	}
	if !strings.Contains(config, "parallel") {
		ev.Suggestions = append(ev.Suggestions, EvolveSuggestion{
			Check:   "pipeline",
			Action:  "parallelize",
			Reason:  "Lint and tests can run in parallel",
			Savings: "20-40% faster pipeline",
		})
	}
	if strings.Count(config, "npm install") > 1 {
		ev.Suggestions = append(ev.Suggestions, EvolveSuggestion{
			Check:   "install",
			Action:  "deduplicate",
			Reason:  "Multiple npm install steps detected",
			Savings: "Eliminate redundant installs",
		})
	}
	return ev
}

// ApplyEvolution generates an updated pipeline config from suggestions.
func ApplyEvolution(config string, suggestions []EvolveSuggestion) string {
	result := config
	for _, s := range suggestions {
		switch s.Action {
		case "add_cache":
			result = addCacheDirective(result)
		case "parallelize":
			result = addParallelDirective(result)
		}
	}
	return result
}

func addCacheDirective(config string) string {
	if strings.Contains(config, "cache:") {
		return config
	}
	return config + "\ncache:\n  - node_modules\n  - .cache\n"
}

func addParallelDirective(config string) string {
	if strings.Contains(config, "parallel:") {
		return config
	}
	return fmt.Sprintf("%s\nparallel: true\n", config)
}
