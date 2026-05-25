package main

import (
	"fmt"
	"os"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/intel"
)

func cmdIndex(args []string) error {
	if wantsHelp(args) {
		printSubUsage("index",
			"pushci index",
			"Build a dependency graph and code intelligence index for blast radius analysis.",
			nil,
			[]string{"pushci index", "pushci index --upload"})
		return nil
	}
	root, _ := os.Getwd()
	cli.Header("PushCI Index — Code Intelligence")

	sp := cli.NewSpinner()

	sp.Start("Scanning codebase...")
	ci, err := intel.BuildCodeIntel(root)
	sp.Stop(err == nil)
	if err != nil {
		return fmt.Errorf("scan failed: %w", err)
	}

	cli.Success(fmt.Sprintf("Indexed %d files, %d symbols, %d dependencies",
		ci.Stats.TotalFiles, ci.Stats.TotalSymbols, ci.Stats.TotalEdges))

	printLanguages(ci)
	printSymbolSample(ci)
	printComplexity(ci)
	printHotspots(root)
	uploadIfAuth(root, ci, sp)

	return nil
}

func printLanguages(ci *intel.CodeIntel) {
	fmt.Println()
	cli.Info("Languages:")
	for lang, count := range ci.Stats.Languages {
		fmt.Printf("  %s %s: %d files\n", cli.Dot(), lang, count)
	}
}

func printSymbolSample(ci *intel.CodeIntel) {
	if len(ci.Symbols) == 0 {
		return
	}
	fmt.Println()
	cli.Info("Exported symbols (sample):")
	shown := 0
	for _, s := range ci.Symbols {
		if shown >= 10 {
			break
		}
		fmt.Printf("  %s %s %s (%s:%d)\n", cli.Dot(), cli.Green(s.Kind), s.Name, s.File, s.Line)
		shown++
	}
	if len(ci.Symbols) > 10 {
		fmt.Printf("  ... and %d more\n", len(ci.Symbols)-10)
	}
}

func printComplexity(ci *intel.CodeIntel) {
	fmt.Println()
	cli.Info("Highest complexity:")
	type entry struct {
		file       string
		complexity int
	}
	var items []entry
	for _, f := range ci.Files {
		if f.Complexity > 0 {
			items = append(items, entry{f.Path, f.Complexity})
		}
	}
	for i := 0; i < len(items); i++ {
		for j := i + 1; j < len(items); j++ {
			if items[j].complexity > items[i].complexity {
				items[i], items[j] = items[j], items[i]
			}
		}
	}
	for i, e := range items {
		if i >= 5 {
			break
		}
		fmt.Printf("  %s %s (complexity: %d)\n", cli.Dot(), e.file, e.complexity)
	}
}
