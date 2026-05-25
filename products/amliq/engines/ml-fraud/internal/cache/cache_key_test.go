package cache

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewCacheKeyBuilder(t *testing.T) {
	ckb := NewCacheKeyBuilder()
	assert.NotNil(t, ckb)
	assert.Empty(t, ckb.parts)
	assert.Empty(t, ckb.tags)
}

func TestCacheKeyBuilder_Add(t *testing.T) {
	ckb := NewCacheKeyBuilder()
	result := ckb.Add("fraud").Add("txn123")
	assert.Same(t, ckb, result, "should return same builder for chaining")
	assert.Len(t, ckb.parts, 2)
}

func TestCacheKeyBuilder_AddTag(t *testing.T) {
	ckb := NewCacheKeyBuilder()
	result := ckb.AddTag("fraud_detection")
	assert.Same(t, ckb, result)
	assert.Len(t, ckb.tags, 1)
}

func TestCacheKeyBuilder_Build(t *testing.T) {
	key := NewCacheKeyBuilder().Add("fraud").Add("txn123").Build()
	assert.Equal(t, "fraud:txn123", key)
}

func TestCacheKeyBuilder_Build_Single(t *testing.T) {
	key := NewCacheKeyBuilder().Add("single").Build()
	assert.Equal(t, "single", key)
}

func TestCacheKeyBuilder_Build_Empty(t *testing.T) {
	key := NewCacheKeyBuilder().Build()
	assert.Equal(t, "", key)
}

func TestCacheKeyBuilder_BuildWithTimestamp(t *testing.T) {
	key := NewCacheKeyBuilder().Add("fraud").Add("txn1").BuildWithTimestamp()
	assert.Contains(t, key, "fraud:txn1:")
	// Timestamp portion should be numeric
	assert.Regexp(t, `^fraud:txn1:\d+$`, key)
}

func TestGenerateHash(t *testing.T) {
	hash1 := GenerateHash("hello")
	hash2 := GenerateHash("hello")
	hash3 := GenerateHash("world")

	assert.Equal(t, hash1, hash2, "same input should produce same hash")
	assert.NotEqual(t, hash1, hash3, "different input should produce different hash")
	assert.Len(t, hash1, 64, "SHA-256 hex digest is 64 chars")
}

func TestGenerateHash_Empty(t *testing.T) {
	hash := GenerateHash("")
	assert.NotEmpty(t, hash)
	assert.Len(t, hash, 64)
}
