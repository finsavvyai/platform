package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/intel"
)

func renderBusFactor(dist map[string]intel.AuthorDistribution, f intelFlags) error {
	if f.json {
		return json.NewEncoder(os.Stdout).Encode(dist)
	}
	cli.Header("Bus-Factor by File")
	rows := [][]string{}
	for _, d := range dist {
		rows = append(rows, []string{
			d.Path,
			fmt.Sprintf("%d", d.BusFactor),
			fmt.Sprintf("%d", d.Total),
			topAuthor(d.Authors),
		})
	}
	cli.Table([]string{"File", "BF", "Touches", "Top Author"}, rows)
	return nil
}

func renderHotspots(dist map[string]intel.AuthorDistribution, f intelFlags) error {
	top := intel.Hotspots(dist, f.topN)
	if f.json {
		return json.NewEncoder(os.Stdout).Encode(top)
	}
	cli.Header(fmt.Sprintf("Hotspots (top %d)", f.topN))
	if len(top) == 0 {
		cli.Info("No risky hotspots found. Healthy codebase!")
		return nil
	}
	rows := [][]string{}
	for _, d := range top {
		rows = append(rows, []string{
			d.Path,
			fmt.Sprintf("BF=%d", d.BusFactor),
			fmt.Sprintf("%dx", d.Total),
			topAuthor(d.Authors),
		})
	}
	cli.Table([]string{"File", "Bus Factor", "Touches", "Only Author"}, rows)
	return nil
}

func topAuthor(authors map[string]int) string {
	var top string
	max := 0
	for a, c := range authors {
		if c > max {
			max, top = c, a
		}
	}
	return top
}
