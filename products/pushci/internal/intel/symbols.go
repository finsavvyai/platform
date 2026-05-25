package intel

// Types and BuildCodeIntel for code intelligence.

// Symbol represents an exported function, type, or constant.
type Symbol struct {
	Name string `json:"name"`
	Kind string `json:"kind"`
	File string `json:"file"`
	Line int    `json:"line"`
}

// FileProfile holds rich metadata about a source file.
type FileProfile struct {
	Path       string   `json:"path"`
	Language   string   `json:"language"`
	Lines      int      `json:"lines"`
	Imports    []string `json:"imports"`
	Exports    []Symbol `json:"exports"`
	Complexity int      `json:"complexity"`
}

// CodeIntel is the full code intelligence index for a repo.
type CodeIntel struct {
	Files    map[string]*FileProfile `json:"files"`
	Symbols  []Symbol                `json:"symbols"`
	DepGraph DepGraph                `json:"dep_graph"`
	Stats    RepoStats               `json:"stats"`
}

// RepoStats summarizes the repo.
type RepoStats struct {
	TotalFiles    int            `json:"total_files"`
	TotalLines    int            `json:"total_lines"`
	TotalSymbols  int            `json:"total_symbols"`
	TotalEdges    int            `json:"total_edges"`
	Languages     map[string]int `json:"languages"`
	LargestFiles  []string       `json:"largest_files"`
	MostConnected []string       `json:"most_connected"`
}

// BuildCodeIntel scans a repo and builds full code intelligence.
func BuildCodeIntel(root string) (*CodeIntel, error) {
	ci := &CodeIntel{
		Files: make(map[string]*FileProfile),
		Stats: RepoStats{Languages: make(map[string]int)},
	}

	graph, err := BuildDepGraph(root)
	if err != nil {
		return nil, err
	}
	ci.DepGraph = graph

	scanFiles(root, ci)

	ci.Stats.TotalSymbols = len(ci.Symbols)
	for _, deps := range graph {
		ci.Stats.TotalEdges += len(deps)
	}
	return ci, nil
}
