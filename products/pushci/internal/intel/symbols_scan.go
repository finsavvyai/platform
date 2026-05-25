package intel

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
)

var langExts = map[string]string{
	".ts": "typescript", ".tsx": "typescript", ".js": "javascript",
	".jsx": "javascript", ".go": "go", ".py": "python",
	".rs": "rust", ".java": "java", ".rb": "ruby",
	".swift": "swift", ".kt": "kotlin", ".cs": "csharp",
}

func scanFiles(root string, ci *CodeIntel) {
	_ = filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return skipDirs(path, info)
		}
		ext := filepath.Ext(path)
		lang, ok := langExts[ext]
		if !ok {
			return nil
		}
		rel, _ := filepath.Rel(root, path)
		profile := profileFile(path, rel, lang)
		ci.Files[rel] = profile
		ci.Symbols = append(ci.Symbols, profile.Exports...)
		ci.Stats.TotalFiles++
		ci.Stats.TotalLines += profile.Lines
		ci.Stats.Languages[lang]++
		return nil
	})
}

func profileFile(path, rel, lang string) *FileProfile {
	f, err := os.Open(path)
	if err != nil {
		return &FileProfile{Path: rel, Language: lang}
	}
	defer f.Close()

	profile := &FileProfile{Path: rel, Language: lang}
	scanner := bufio.NewScanner(f)
	lineNum := 0

	for scanner.Scan() {
		lineNum++
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)

		if isComplexityToken(trimmed, lang) {
			profile.Complexity++
		}

		symbols := extractSymbols(trimmed, rel, lang, lineNum)
		profile.Exports = append(profile.Exports, symbols...)
	}
	profile.Lines = lineNum
	return profile
}

// Symbol extractors and complexity analysis are in extractors.go
