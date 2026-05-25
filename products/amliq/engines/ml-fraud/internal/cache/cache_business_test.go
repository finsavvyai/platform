package cache

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCacheTransactionResult(t *testing.T) {
	cm, _ := NewCacheManager(newLocalOnlyConfig())
	ctx := context.Background()
	err := cm.CacheTransactionResult(ctx, "txn1", "result", nil)
	assert.NoError(t, err)
	_, exists := cm.getLocalCache("transaction:txn1")
	assert.True(t, exists)
}

func TestCacheQuantumResult(t *testing.T) {
	cm, _ := NewCacheManager(newLocalOnlyConfig())
	ctx := context.Background()
	err := cm.CacheQuantumResult(ctx, "vqc", "hash1", "result", nil)
	assert.NoError(t, err)
	_, exists := cm.getLocalCache("quantum:vqc:hash1")
	assert.True(t, exists)
}

func TestCacheModelResult(t *testing.T) {
	cm, _ := NewCacheManager(newLocalOnlyConfig())
	ctx := context.Background()
	err := cm.CacheModelResult(ctx, "fraud", "hash2", "pred", nil)
	assert.NoError(t, err)
	_, exists := cm.getLocalCache("model:fraud:hash2")
	assert.True(t, exists)
}

func TestGetTransactionResult_Miss(t *testing.T) {
	cm, _ := NewCacheManager(newLocalOnlyConfig())
	ctx := context.Background()
	result, err := cm.GetTransactionResult(ctx, "missing", nil)
	assert.NoError(t, err)
	assert.False(t, result.Found)
}

func TestGetQuantumResult_Miss(t *testing.T) {
	cm, _ := NewCacheManager(newLocalOnlyConfig())
	ctx := context.Background()
	result, err := cm.GetQuantumResult(ctx, "vqc", "miss", nil)
	assert.NoError(t, err)
	assert.False(t, result.Found)
}

func TestGetModelResult_Miss(t *testing.T) {
	cm, _ := NewCacheManager(newLocalOnlyConfig())
	ctx := context.Background()
	result, err := cm.GetModelResult(ctx, "fraud", "miss", nil)
	assert.NoError(t, err)
	assert.False(t, result.Found)
}

func TestCacheTransactionResult_CustomOptions(t *testing.T) {
	cm, _ := NewCacheManager(newLocalOnlyConfig())
	ctx := context.Background()
	opts := &CacheOptions{TTL: 30000000000, Tags: []string{"custom"}}
	err := cm.CacheTransactionResult(ctx, "txn2", "data", opts)
	assert.NoError(t, err)
}
