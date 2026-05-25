package cache

import (
	"context"
	"crypto/sha256"
	"fmt"
	"os"
	"path/filepath"

	"github.com/finsavvyai/pushci/internal/detect"
)

// lockfiles maps stacks to their dependency lockfile names.
var lockfiles = map[detect.Stack]string{
	detect.Node:   "package-lock.json",
	detect.Go:     "go.sum",
	detect.Python: "requirements.txt",
	detect.Rust:   "Cargo.lock",
}

// cacheNames maps stacks to the artifact directory name.
var cacheNames = map[detect.Stack]string{
	detect.Node:   "node_modules",
	detect.Go:     "go-mod-cache",
	detect.Python: "venv",
	detect.Rust:   "target",
}

// PredictDeps returns the dependency artifact names that should be
// pre-cached for the given project.
func PredictDeps(project detect.Project) []string {
	name, ok := cacheNames[project.Stack]
	if !ok {
		return nil
	}
	return []string{name}
}

// LockfileHash returns the SHA-256 hash of the project's lockfile,
// or empty string if not found.
func LockfileHash(root string, project detect.Project) string {
	lf, ok := lockfiles[project.Stack]
	if !ok {
		return ""
	}
	path := filepath.Join(root, project.Dir, lf)
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return fmt.Sprintf("%x", sha256.Sum256(data))
}

// PreWarm checks whether the project's dependencies are cached and
// stores a marker if not. Returns nil if already warm.
func PreWarm(ctx context.Context, project detect.Project, root string, gc *GlobalCache) error {
	hash := LockfileHash(root, project)
	if hash == "" {
		return nil
	}
	deps := PredictDeps(project)
	if len(deps) == 0 {
		return nil
	}
	key := gc.Key(string(project.Stack), hash)
	if _, ok := gc.Get(key); ok {
		return nil // already cached
	}
	// Store a placeholder; real implementation would install deps.
	return gc.Put(key, []byte("warm:"+deps[0]))
}
