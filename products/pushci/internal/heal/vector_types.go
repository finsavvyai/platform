package heal

import "time"

// RunRecord is the minimum info to index a run in the vector store.
type RunRecord struct {
	Repo       string    `json:"repo"`
	SHA        string    `json:"sha"`
	Status     string    `json:"status"`
	Stage      string    `json:"stage"`
	Command    string    `json:"command"`
	ExitCode   int       `json:"exit_code"`
	Stderr     string    `json:"stderr"`
	RootCause  string    `json:"root_cause"`
	AppliedFix string    `json:"applied_fix"`
	Outcome    string    `json:"outcome"`
	Timestamp  time.Time `json:"timestamp"`
}

// SimilarRun is one Query hit, ordered by descending similarity.
type SimilarRun struct {
	Record     RunRecord `json:"record"`
	Similarity float64   `json:"similarity"`
}

type vectorDoc struct {
	Record RunRecord `json:"record"`
	Vec    []float32 `json:"vec"`
}
