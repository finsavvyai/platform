package main

import "github.com/finsavvyai/pushci/internal/config"

// appendSecondaryStages merges heuristic-generated stages onto a
// primary (buildspec-derived) pipeline. Heuristic stages whose name
// already appears in the primary are dropped — the buildspec is the
// source of truth for "what commands do we run at build time". Only
// genuinely new stages (e.g. Python lint when the buildspec only runs
// Maven) are appended, and they depend on the last primary stage so
// they don't race with the real build flow.
//
// Design note: we don't merge inside a stage. That would make it
// impossible to tell which commands came from the buildspec and which
// from the detector, and it would encourage the user to edit a stage
// where one side could rewrite the other on the next `pushci init`.
func appendSecondaryStages(primary, heuristic []config.Stage) []config.Stage {
	if len(heuristic) == 0 {
		return primary
	}
	seen := map[string]bool{}
	for _, s := range primary {
		seen[s.Name] = true
	}
	lastPrimary := ""
	if n := len(primary); n > 0 {
		lastPrimary = primary[n-1].Name
	}
	// Build the rename map first so intra-heuristic depends_on can
	// be remapped. Without this, a heur stage that depends on
	// "node-install" still references the pre-rename name after the
	// secondary rename, producing a broken topology.
	rename := map[string]string{}
	for _, s := range heuristic {
		renamed := "heur-" + s.Name
		if seen[s.Name] || seen[renamed] {
			continue
		}
		rename[s.Name] = renamed
	}
	out := append([]config.Stage{}, primary...)
	for _, s := range heuristic {
		renamed, ok := rename[s.Name]
		if !ok {
			continue
		}
		if len(s.DependsOn) == 0 && lastPrimary != "" {
			s.DependsOn = []string{lastPrimary}
		} else {
			remapped := make([]string, 0, len(s.DependsOn))
			for _, d := range s.DependsOn {
				if r, ok := rename[d]; ok {
					remapped = append(remapped, r)
				} else {
					remapped = append(remapped, d)
				}
			}
			s.DependsOn = remapped
		}
		s.Name = renamed
		out = append(out, s)
		seen[renamed] = true
	}
	return out
}
