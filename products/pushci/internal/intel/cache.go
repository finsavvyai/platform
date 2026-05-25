package intel

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
)

// Cache tracks file hashes to skip unchanged checks.
type Cache struct {
	path    string
	Entries map[string]string `json:"entries"`
}

// NewCache creates a cache backed by .pushci/cache.json under root.
func NewCache(root string) *Cache {
	return &Cache{
		path:    filepath.Join(root, ".pushci", "cache.json"),
		Entries: make(map[string]string),
	}
}

// Key builds a cache key from project dir and check name.
func Key(project, check string) string {
	return project + ":" + check
}

// Hash computes SHA256 of all source files in dir (sorted).
func Hash(dir string) (string, error) {
	h := sha256.New()
	var files []string
	err := filepath.WalkDir(dir, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() && d.Name() == ".git" {
			return filepath.SkipDir
		}
		if !d.IsDir() {
			files = append(files, p)
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	sort.Strings(files)
	for _, f := range files {
		data, err := os.ReadFile(f)
		if err != nil {
			return "", err
		}
		h.Write([]byte(f))
		h.Write(data)
	}
	return fmt.Sprintf("%x", h.Sum(nil)), nil
}

// IsHit returns true if the stored hash matches.
func (c *Cache) IsHit(key, hash string) bool {
	return c.Entries[key] == hash
}

// Store saves a hash for the given key.
func (c *Cache) Store(key, hash string) {
	c.Entries[key] = hash
}

// Load reads the cache file from disk.
func (c *Cache) Load() {
	data, err := os.ReadFile(c.path)
	if err != nil {
		return
	}
	_ = json.Unmarshal(data, c)
}

// Save writes the cache file to disk.
func (c *Cache) Save() error {
	if err := os.MkdirAll(filepath.Dir(c.path), 0o755); err != nil {
		return err
	}
	data, err := json.Marshal(c)
	if err != nil {
		return err
	}
	return os.WriteFile(c.path, data, 0o644)
}
