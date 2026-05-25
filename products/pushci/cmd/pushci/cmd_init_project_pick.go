package main

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/detect"
)

// pickProjectsInteractive prompts the user to select which detected
// projects (build sources) drive the generated pushci.yml. Active
// only when stdin is a TTY and >1 project was detected; codegen
// and bin/ subdirs are deselected by default.
func pickProjectsInteractive(projects []detect.Project) []detect.Project {
	if len(projects) <= 1 || isNonInteractive(os.Args[2:]) {
		return projects
	}
	included := make([]bool, len(projects))
	for i, p := range projects {
		included[i] = !looksGenerated(p.Dir)
	}
	fmt.Println()
	cli.Info("Multiple projects detected. Select which to include:")
	runProjectPickerLoop(projects, included)
	return collectIncludedProjects(projects, included)
}

func runProjectPickerLoop(projects []detect.Project, included []bool) {
	for {
		printProjectChoices(projects, included)
		fmt.Print("\n  Toggle [number], Enter to confirm, A=all, N=none: ")
		choice := readLine()
		if choice == "" {
			return
		}
		if applyBulkChoice(choice, included) {
			continue
		}
		if idx, err := strconv.Atoi(choice); err == nil && idx >= 1 && idx <= len(projects) {
			included[idx-1] = !included[idx-1]
		}
	}
}

func applyBulkChoice(choice string, included []bool) bool {
	switch strings.ToLower(choice) {
	case "a", "all":
		for i := range included {
			included[i] = true
		}
		return true
	case "n", "none":
		for i := range included {
			included[i] = false
		}
		return true
	}
	return false
}

func collectIncludedProjects(projects []detect.Project, included []bool) []detect.Project {
	out := projects[:0:0]
	for i, p := range projects {
		if included[i] {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		cli.Warn("No projects selected; falling back to all detected projects.")
		return projects
	}
	return out
}
