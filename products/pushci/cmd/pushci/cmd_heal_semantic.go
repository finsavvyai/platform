package main

// pushci heal --semantic
//
// Query the local vector store for runs similar to the current error.
// Embeddings stay ON USER'S MACHINE — no network call, no third-party
// service. Index with PUSHCI_VECTOR_INDEX=1 env var during `pushci run`.

import (
	"context"
	"fmt"
	"io"
	"os"

	"github.com/finsavvyai/pushci/internal/heal"
)

// vectorQuerier is the VectorStore surface used by the command.
// Declared as an interface so tests can inject a fake without
// touching the filesystem.
type vectorQuerier interface {
	Query(ctx context.Context, errorMsg string, k int) ([]heal.SimilarRun, error)
}

// runHealSemantic writes a ranked diagnosis to w. Curated pattern
// match (if any) comes first; vector-similar hits follow.
func runHealSemantic(ctx context.Context, vs vectorQuerier, errorMsg string, k int, w io.Writer) (*heal.SemanticDiagnosis, error) {
	d := &heal.SemanticDiagnosis{Fix: heal.DiagnoseOutput(errorMsg)}
	if vs != nil {
		sims, err := vs.Query(ctx, errorMsg, k)
		if err != nil {
			return d, err
		}
		d.Similar = sims
	}
	writeSemanticDiagnosis(w, d)
	return d, nil
}

func writeSemanticDiagnosis(w io.Writer, d *heal.SemanticDiagnosis) {
	if d.Fix != nil {
		fmt.Fprintf(w, "Curated match: [%s] -> %s\n", d.Fix.Pattern, d.Fix.Action)
	} else {
		fmt.Fprintln(w, "No curated pattern matched.")
	}
	if len(d.Similar) == 0 {
		fmt.Fprintln(w, "No similar failures in local history.")
		fmt.Fprintln(w, "(Set PUSHCI_VECTOR_INDEX=1 on future runs to build up history.)")
		return
	}
	fmt.Fprintf(w, "\n%d similar failures in your history:\n", len(d.Similar))
	for i, s := range d.Similar {
		fmt.Fprintf(w, "  %d. [%s, similarity=%.2f] %s\n",
			i+1, s.Record.Timestamp.Format("2006-01-02"), s.Similarity, formatHit(s.Record))
	}
	fmt.Fprintln(w, "\nAll queries ran locally. No data left this machine.")
}

func formatHit(r heal.RunRecord) string {
	fix := r.AppliedFix
	if fix == "" {
		fix = "(no fix applied)"
	}
	return fmt.Sprintf("%s -> fixed by %s [%s]", trimForLog(r.Stderr, 60), fix, r.Outcome)
}

func trimForLog(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

// openVectorStoreOrNil opens the default store; returns nil on error.
func openVectorStoreOrNil() *heal.VectorStore {
	vs, err := heal.Open("")
	if err != nil {
		return nil
	}
	return vs
}

// cmdHealSemantic is called from cmdHeal when --semantic is present.
func cmdHealSemantic(ctx context.Context) error {
	msg := readStdinAll()
	if msg == "" {
		fmt.Fprintln(os.Stdout, "pushci heal --semantic: no error on stdin.")
		fmt.Fprintln(os.Stdout, "Pipe a failure: `pushci run 2>&1 | pushci heal --semantic`.")
		return nil
	}
	_, err := runHealSemantic(ctx, openVectorStoreOrNil(), msg, 3, os.Stdout)
	return err
}
