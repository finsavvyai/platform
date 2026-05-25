//go:build ignore

package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/cloudflare/cloudflare-go"
	"github.com/sirupsen/logrus"
)

// CloudflareKVStore implements KVStore interface using Cloudflare KV
type CloudflareKVStore struct {
	client      *cloudflare.API
	accountID   string
	namespaceID string
	logger      *logrus.Logger
}

// NewCloudflareKVStore creates a new Cloudflare KV store instance
func NewCloudflareKVStore(apiToken, accountID, namespaceID string, logger *logrus.Logger) (*CloudflareKVStore, error) {
	client, err := cloudflare.NewWithAPIToken(apiToken)
	if err != nil {
		return nil, fmt.Errorf("failed to create Cloudflare client: %w", err)
	}

	// Test connection
	_, err = client.AccountDetails(context.Background())
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Cloudflare API: %w", err)
	}

	return &CloudflareKVStore{
		client:      client,
		accountID:   accountID,
		namespaceID: namespaceID,
		logger:      logger,
	}, nil
}

// Get implements KVStore interface
func (kv *CloudflareKVStore) Get(ctx context.Context, key string) ([]byte, error) {
	start := time.Now()
	defer func() {
		kv.logger.WithFields(logrus.Fields{
			"operation":   "get",
			"key":         key,
			"duration_ms": time.Since(start).Milliseconds(),
		}).Debug("KV operation completed")
	}()

	result, err := kv.client.GetWorkersKV(ctx, cloudflare.AccountIdentifier(kv.accountID), kv.namespaceID, key)
	if err != nil {
		if strings.Contains(err.Error(), "1009") {
			// Key not found
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get key %s: %w", key, err)
	}

	return []byte(result), nil
}

// Set implements KVStore interface
func (kv *CloudflareKVStore) Set(ctx context.Context, key string, value []byte, ttl time.Duration) error {
	start := time.Now()
	defer func() {
		kv.logger.WithFields(logrus.Fields{
			"operation":   "set",
			"key":         key,
			"ttl":         ttl.String(),
			"duration_ms": time.Since(start).Milliseconds(),
		}).Debug("KV operation completed")
	}()

	// Cloudflare KV TTL is in seconds
	ttlSeconds := int(ttl.Seconds())
	if ttlSeconds < 60 {
		ttlSeconds = 60 // Minimum TTL for Cloudflare KV
	}

	err := kv.client.PutWorkersKV(ctx, cloudflare.AccountIdentifier(kv.accountID), kv.namespaceID, key, string(value))
	if err != nil {
		return fmt.Errorf("failed to set key %s: %w", key, err)
	}

	// Cloudflare KV doesn't support TTL in the Put operation
	// TTL needs to be set using SetWorkersKVExpiration if needed
	if ttlSeconds > 0 {
		err = kv.client.SetWorkersKVExpiration(ctx, cloudflare.AccountIdentifier(kv.accountID), kv.namespaceID, key, cloudflare.KVExpiration(ttlSeconds))
		if err != nil {
			kv.logger.WithError(err).Warn("Failed to set TTL for key, will use default")
		}
	}

	return nil
}

// Delete implements KVStore interface
func (kv *CloudflareKVStore) Delete(ctx context.Context, key string) error {
	start := time.Now()
	defer func() {
		kv.logger.WithFields(logrus.Fields{
			"operation":   "delete",
			"key":         key,
			"duration_ms": time.Since(start).Milliseconds(),
		}).Debug("KV operation completed")
	}()

	err := kv.client.DeleteWorkersKV(ctx, cloudflare.AccountIdentifier(kv.accountID), kv.namespaceID, key)
	if err != nil {
		return fmt.Errorf("failed to delete key %s: %w", key, err)
	}

	return nil
}

// BulkGet implements KVStore interface using multiple requests
func (kv *CloudflareKVStore) BulkGet(ctx context.Context, keys []string) (map[string][]byte, error) {
	start := time.Now()
	defer func() {
		kv.logger.WithFields(logrus.Fields{
			"operation":   "bulk_get",
			"key_count":   len(keys),
			"duration_ms": time.Since(start).Milliseconds(),
		}).Debug("KV operation completed")
	}()

	results := make(map[string][]byte)

	// Cloudflare KV doesn't have native bulk operations, so we'll parallelize
	type result struct {
		key   string
		value []byte
		err   error
	}

	resultChan := make(chan result, len(keys))

	// Process keys in parallel
	for _, key := range keys {
		go func(k string) {
			value, err := kv.Get(ctx, k)
			resultChan <- result{key: k, value: value, err: err}
		}(key)
	}

	// Collect results
	for i := 0; i < len(keys); i++ {
		res := <-resultChan
		if res.err != nil {
			kv.logger.WithError(res.err).WithField("key", res.key).Warn("Failed to get key in bulk operation")
			continue
		}
		if res.value != nil {
			results[res.key] = res.value
		}
	}

	return results, nil
}

// BulkSet implements KVStore interface using multiple requests
func (kv *CloudflareKVStore) BulkSet(ctx context.Context, items map[string][]byte, ttl time.Duration) error {
	start := time.Now()
	defer func() {
		kv.logger.WithFields(logrus.Fields{
			"operation":   "bulk_set",
			"item_count":  len(items),
			"ttl":         ttl.String(),
			"duration_ms": time.Since(start).Milliseconds(),
		}).Debug("KV operation completed")
	}()

	// Cloudflare KV doesn't have native bulk operations, so we'll parallelize
	type result struct {
		key string
		err error
	}

	resultChan := make(chan result, len(items))

	// Process items in parallel
	for key, value := range items {
		go func(k string, v []byte) {
			err := kv.Set(ctx, k, v, ttl)
			resultChan <- result{key: k, err: err}
		}(key, value)
	}

	// Collect results and check for errors
	var errors []string
	for i := 0; i < len(items); i++ {
		res := <-resultChan
		if res.err != nil {
			errors = append(errors, fmt.Sprintf("key %s: %v", res.key, res.err))
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("failed to set some keys: %s", strings.Join(errors, "; "))
	}

	return nil
}

// Increment implements KVStore interface using a counter pattern
func (kv *CloudflareKVStore) Increment(ctx context.Context, key string, delta int64, ttl time.Duration) (int64, error) {
	start := time.Now()
	defer func() {
		kv.logger.WithFields(logrus.Fields{
			"operation":   "increment",
			"key":         key,
			"delta":       delta,
			"ttl":         ttl.String(),
			"duration_ms": time.Since(start).Milliseconds(),
		}).Debug("KV operation completed")
	}()

	// Get current value
	data, err := kv.Get(ctx, key)
	if err != nil {
		return 0, fmt.Errorf("failed to get current value: %w", err)
	}

	var currentValue int64
	if len(data) > 0 {
		currentValue, err = strconv.ParseInt(string(data), 10, 64)
		if err != nil {
			return 0, fmt.Errorf("failed to parse current value: %w", err)
		}
	}

	// Increment and save
	newValue := currentValue + delta
	newValueStr := strconv.FormatInt(newValue, 10)

	err = kv.Set(ctx, key, []byte(newValueStr), ttl)
	if err != nil {
		return 0, fmt.Errorf("failed to save new value: %w", err)
	}

	return newValue, nil
}

// GetRange implements KVStore interface using list operation
func (kv *CloudflareKVStore) GetRange(ctx context.Context, prefix string) (map[string][]byte, error) {
	start := time.Now()
	defer func() {
		kv.logger.WithFields(logrus.Fields{
			"operation":   "get_range",
			"prefix":      prefix,
			"duration_ms": time.Since(start).Milliseconds(),
		}).Debug("KV operation completed")
	}()

	results := make(map[string][]byte)

	// Use ListKeys to find all keys with the prefix
	list, err := kv.client.ListWorkersKVs(ctx, cloudflare.AccountIdentifier(kv.accountID), kv.namespaceID, cloudflare.ListWorkersKVsParams{
		Prefix: prefix,
		Limit:  1000, // Maximum allowed
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list keys with prefix %s: %w", prefix, err)
	}

	// Get all the keys
	for _, keyInfo := range list.Result {
		data, err := kv.Get(ctx, keyInfo.Name)
		if err != nil {
			kv.logger.WithError(err).WithField("key", keyInfo.Name).Warn("Failed to get key in range operation")
			continue
		}
		if data != nil {
			results[keyInfo.Name] = data
		}
	}

	// Handle pagination if needed
	cursor := list.ResultInfo.Cursor
	for list.ResultInfo.Cursor != "" && len(results) < list.ResultInfo.TotalCount {
		list, err = kv.client.ListWorkersKVs(ctx, cloudflare.AccountIdentifier(kv.accountID), kv.namespaceID, cloudflare.ListWorkersKVsParams{
			Prefix: prefix,
			Limit:  1000,
			Cursor: cursor,
		})
		if err != nil {
			kv.logger.WithError(err).Warn("Failed to get next page of keys")
			break
		}

		for _, keyInfo := range list.Result {
			data, err := kv.Get(ctx, keyInfo.Name)
			if err != nil {
				kv.logger.WithError(err).WithField("key", keyInfo.Name).Warn("Failed to get key in range operation")
				continue
			}
			if data != nil {
				results[keyInfo.Name] = data
			}
		}

		cursor = list.ResultInfo.Cursor
	}

	return results, nil
}

// GetStats returns KV storage statistics
func (kv *CloudflareKVStore) GetStats(ctx context.Context) (*KVStats, error) {
	// Cloudflare KV doesn't provide detailed stats through API
	// This would need to be implemented using Cloudflare Analytics or custom tracking
	return &KVStats{
		TotalKeys:       0,
		TotalSizeBytes:  0,
		ReadOperations:  0,
		WriteOperations: 0,
		AverageLatency:  0,
		LastUpdated:     time.Now(),
	}, nil
}

// KVStats represents KV storage statistics
type KVStats struct {
	TotalKeys       int64     `json:"total_keys"`
	TotalSizeBytes  int64     `json:"total_size_bytes"`
	ReadOperations  int64     `json:"read_operations"`
	WriteOperations int64     `json:"write_operations"`
	AverageLatency  int64     `json:"average_latency_ms"`
	LastUpdated     time.Time `json:"last_updated"`
}

// Cleanup removes expired keys (implementation depends on your cleanup strategy)
func (kv *CloudflareKVStore) Cleanup(ctx context.Context, olderThan time.Duration) error {
	kv.logger.WithField("older_than", olderThan).Info("Starting KV cleanup")

	// This would need to be implemented based on your cleanup strategy
	// Cloudflare KV automatically expires keys with TTL set
	// For manual cleanup, you'd need to track key creation times separately

	return nil
}

// Export exports keys to JSON for backup/migration
func (kv *CloudflareKVStore) Export(ctx context.Context, prefix string) ([]byte, error) {
	data, err := kv.GetRange(ctx, prefix)
	if err != nil {
		return nil, fmt.Errorf("failed to get data for export: %w", err)
	}

	exportData := map[string]interface{}{
		"prefix":      prefix,
		"export_time": time.Now(),
		"total_keys":  len(data),
		"data":        data,
	}

	return json.MarshalIndent(exportData, "", "  ")
}

// Import imports keys from JSON export
func (kv *CloudflareKVStore) Import(ctx context.Context, exportData []byte, ttl time.Duration) error {
	var importData map[string]interface{}
	if err := json.Unmarshal(exportData, &importData); err != nil {
		return fmt.Errorf("failed to unmarshal export data: %w", err)
	}

	dataInterface, ok := importData["data"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("invalid export data format")
	}

	items := make(map[string][]byte)
	for key, value := range dataInterface {
		valueStr, ok := value.(string)
		if !ok {
			return fmt.Errorf("invalid value format for key %s", key)
		}
		items[key] = []byte(valueStr)
	}

	return kv.BulkSet(ctx, items, ttl)
}
