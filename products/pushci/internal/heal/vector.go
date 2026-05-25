package heal

// Vector store for semantic heal (v1.7.0). Embedder: Option C
// (pure-Go hashing-based). Upgrade to mxbai-embed-large via llamafile
// in v1.8.0. Privacy: Index + Query touch NO network. Vectors persist
// as local JSON under ~/.pushci/vector/ ($PUSHCI_VECTOR_DIR override).

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"
)

// VectorStore is an append-only on-disk vector index.
type VectorStore struct {
	path string
	docs []vectorDoc
}

// Open loads (or creates) a store. "" -> $PUSHCI_VECTOR_DIR or ~/.pushci/vector/.
func Open(path string) (*VectorStore, error) {
	if path == "" {
		path = os.Getenv("PUSHCI_VECTOR_DIR")
	}
	if path == "" {
		home, _ := os.UserHomeDir()
		path = filepath.Join(home, ".pushci", "vector")
	}
	if err := os.MkdirAll(path, 0o755); err != nil { // #nosec G703 G704 G122 -- CLI tool: paths/URLs are user-supplied
		return nil, err
	}
	vs := &VectorStore{path: path}
	if data, err := os.ReadFile(filepath.Join(path, "index.json")); err == nil { // #nosec G703 G704 G122 -- CLI tool: paths/URLs are user-supplied
		_ = json.Unmarshal(data, &vs.docs)
	}
	return vs, nil
}

// Index embeds + persists a run. Best-effort, never blocks.
func (vs *VectorStore) Index(ctx context.Context, r RunRecord) error {
	if ctx.Err() != nil {
		return ctx.Err()
	}
	if r.Timestamp.IsZero() {
		r.Timestamp = time.Now().UTC()
	}
	t := fmt.Sprintf("%s %s %s %s %s %s", r.Stderr, r.Stage, r.Command, r.RootCause, r.AppliedFix, r.Outcome)
	vs.docs = append(vs.docs, vectorDoc{Record: r, Vec: hashEmbed(t)})
	return vs.flush()
}

// Query returns top-k most similar prior runs for errorMsg.
func (vs *VectorStore) Query(ctx context.Context, errorMsg string, k int) ([]SimilarRun, error) {
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	if k <= 0 || len(vs.docs) == 0 {
		return nil, nil
	}
	q := hashEmbed(errorMsg)
	out := make([]SimilarRun, 0, len(vs.docs))
	for _, d := range vs.docs {
		out = append(out, SimilarRun{Record: d.Record, Similarity: cosine(q, d.Vec)})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Similarity > out[j].Similarity })
	if len(out) > k {
		out = out[:k]
	}
	return out, nil
}

func (vs *VectorStore) flush() error {
	b, err := json.Marshal(vs.docs)
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(vs.path, "index.json"), b, 0o644)
}
