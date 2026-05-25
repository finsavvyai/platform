package heal

import "context"

// DiagnoseOutput runs all strategies against an output string
// and returns the first matching fix, or nil if none match.
func DiagnoseOutput(output string) *Fix {
	for _, s := range allStrategies() {
		if fix := s(output); fix != nil {
			return fix
		}
	}
	return nil
}

// SemanticDiagnosis combines curated pattern strategies with
// vector-similar past failures from the user's local history.
// Curated patterns ALWAYS rank above vector hits — the vector
// store only surfaces when no pattern matches.
type SemanticDiagnosis struct {
	Fix     *Fix         // curated pattern match, if any
	Similar []SimilarRun // top-k similar past runs (local history)
}

// DiagnoseSemantic runs curated pattern strategies, then consults
// the vector store for similar past failures. It never blocks on
// network I/O and returns whatever results are available locally.
func DiagnoseSemantic(ctx context.Context, vs *VectorStore, output string, k int) (*SemanticDiagnosis, error) {
	d := &SemanticDiagnosis{Fix: DiagnoseOutput(output)}
	if vs == nil {
		return d, nil
	}
	sims, err := vs.Query(ctx, output, k)
	if err != nil {
		return d, err
	}
	d.Similar = sims
	return d, nil
}
