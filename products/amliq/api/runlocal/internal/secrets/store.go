package secrets

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Store manages encrypted environment variables per project.
type Store struct {
	path string
	key  []byte
}

// New creates a secret store in the given directory.
// The key is derived from the machine ID + project path.
func New(dir string) (*Store, error) {
	path := filepath.Join(dir, ".pushci", "secrets.enc")
	key := deriveKey(dir)
	os.MkdirAll(filepath.Dir(path), 0o700)
	return &Store{path: path, key: key}, nil
}

func deriveKey(seed string) []byte {
	hostname, _ := os.Hostname()
	h := sha256.Sum256([]byte(seed + ":" + hostname + ":pushci"))
	return h[:]
}

// Set stores an encrypted key-value pair.
func (s *Store) Set(key, value string) error {
	data := s.loadAll()
	data[key] = value
	return s.saveAll(data)
}

// Get retrieves a decrypted value by key.
func (s *Store) Get(key string) (string, bool) {
	data := s.loadAll()
	v, ok := data[key]
	return v, ok
}

// List returns all secret keys (not values).
func (s *Store) List() []string {
	data := s.loadAll()
	keys := make([]string, 0, len(data))
	for k := range data {
		keys = append(keys, k)
	}
	return keys
}

// Delete removes a secret by key.
func (s *Store) Delete(key string) error {
	data := s.loadAll()
	delete(data, key)
	return s.saveAll(data)
}

func (s *Store) loadAll() map[string]string {
	enc, err := os.ReadFile(s.path)
	if err != nil {
		return make(map[string]string)
	}
	plain, err := decrypt(enc, s.key)
	if err != nil {
		return make(map[string]string)
	}
	var data map[string]string
	json.Unmarshal(plain, &data)
	if data == nil {
		return make(map[string]string)
	}
	return data
}

func (s *Store) saveAll(data map[string]string) error {
	plain, _ := json.Marshal(data)
	enc, err := encrypt(plain, s.key)
	if err != nil {
		return fmt.Errorf("encrypt: %w", err)
	}
	return os.WriteFile(s.path, enc, 0o600)
}
