package cache

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// R2Store implements CacheStore using Cloudflare R2 object storage.
type R2Store struct {
	AccountID   string
	BucketName  string
	AccessKeyID string
	SecretKey   string
	client      *http.Client
}

// NewR2Store creates an R2-backed cache store.
func NewR2Store(accountID, bucket, accessKey, secretKey string) *R2Store {
	return &R2Store{
		AccountID:   accountID,
		BucketName:  bucket,
		AccessKeyID: accessKey,
		SecretKey:   secretKey,
		client:      &http.Client{Timeout: 30 * time.Second},
	}
}

func (r *R2Store) endpoint(key string) string {
	return fmt.Sprintf("https://%s.r2.cloudflarestorage.com/%s/%s",
		r.AccountID, r.BucketName, key)
}

// Get retrieves an object from R2. Returns nil, false on miss.
func (r *R2Store) Get(key string) ([]byte, bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, "GET", r.endpoint(key), nil)
	resp, err := r.client.Do(req)
	if err != nil || resp.StatusCode != 200 {
		return nil, false
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	return data, true
}

// Put stores an object in R2.
func (r *R2Store) Put(key string, data []byte) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, "PUT", r.endpoint(key), bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/octet-stream")
	resp, err := r.client.Do(req)
	if err != nil {
		return fmt.Errorf("r2 put: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("r2 put: status %d", resp.StatusCode)
	}
	return nil
}

// Delete removes an object from R2.
func (r *R2Store) Delete(key string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, "DELETE", r.endpoint(key), nil)
	resp, err := r.client.Do(req)
	if err != nil {
		return fmt.Errorf("r2 delete: %w", err)
	}
	defer resp.Body.Close()
	return nil
}

// Manifest holds metadata about cached artifacts.
type Manifest struct {
	Entries []ManifestEntry `json:"entries"`
}

// ManifestEntry describes one cached artifact.
type ManifestEntry struct {
	Key       string    `json:"key"`
	Size      int64     `json:"size"`
	CreatedAt time.Time `json:"created_at"`
	Stack     string    `json:"stack"`
}

// SaveManifest writes the cache manifest to R2.
func (r *R2Store) SaveManifest(m *Manifest) error {
	data, _ := json.Marshal(m)
	return r.Put("_manifest.json", data)
}
