package main

import "github.com/finsavvyai/pushci/internal/config"

// topoSortStages reorders stages so that every stage appears
// after all of its depends_on entries. If a cycle or missing
// dependency is detected, the original order is returned
// unchanged (better to run in the user's order than to crash).
//
// The sort is stable: stages with no dependency relationship
// preserve their relative input order.
func topoSortStages(stages []config.Stage) []config.Stage {
	idx := map[string]int{}
	for i, s := range stages {
		idx[s.Name] = i
	}

	visited := make([]bool, len(stages))
	temp := make([]bool, len(stages))
	var order []config.Stage
	hasCycle := false

	var visit func(i int)
	visit = func(i int) {
		if hasCycle || visited[i] {
			return
		}
		if temp[i] {
			hasCycle = true
			return
		}
		temp[i] = true
		for _, dep := range stages[i].DependsOn {
			if j, ok := idx[dep]; ok {
				visit(j)
			}
		}
		temp[i] = false
		visited[i] = true
		order = append(order, stages[i])
	}

	for i := range stages {
		visit(i)
	}
	if hasCycle || len(order) != len(stages) {
		return stages
	}
	return order
}
