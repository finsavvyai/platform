package storage

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateAPIKey_Basic(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.CreateAPIKey("gh-main", "sha256hashvalue"))

	connName, err := db.ValidateAPIKey("sha256hashvalue")
	require.NoError(t, err)
	assert.Equal(t, "gh-main", connName)
}

func TestCreateAPIKey_Upsert(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.CreateAPIKey("gh-main", "hash-v1"))
	require.NoError(t, db.CreateAPIKey("gh-main", "hash-v2")) // replaces hash-v1

	// old hash should no longer work
	_, err := db.ValidateAPIKey("hash-v1")
	require.Error(t, err)

	// new hash should work
	connName, err := db.ValidateAPIKey("hash-v2")
	require.NoError(t, err)
	assert.Equal(t, "gh-main", connName)
}

func TestCreateAPIKey_EmptyConnectionName(t *testing.T) {
	db := newTestDB(t)

	err := db.CreateAPIKey("", "somehash")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "required")
}

func TestCreateAPIKey_EmptyHash(t *testing.T) {
	db := newTestDB(t)

	err := db.CreateAPIKey("gh-main", "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "required")
}

func TestValidateAPIKey_NotFound(t *testing.T) {
	db := newTestDB(t)

	_, err := db.ValidateAPIKey("nonexistent-hash")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestValidateAPIKey_EmptyHash(t *testing.T) {
	db := newTestDB(t)

	_, err := db.ValidateAPIKey("")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "required")
}

func TestDeleteAPIKey_Success(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.CreateAPIKey("gh-main", "hash-abc"))
	require.NoError(t, db.DeleteAPIKey("gh-main"))

	_, err := db.ValidateAPIKey("hash-abc")
	require.Error(t, err) // should be gone
}

func TestDeleteAPIKey_EmptyConnectionName(t *testing.T) {
	db := newTestDB(t)

	err := db.DeleteAPIKey("")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "required")
}

func TestDeleteAPIKey_Nonexistent(t *testing.T) {
	db := newTestDB(t)

	// DeleteAPIKey does not check rows-affected, so no error for missing row
	require.NoError(t, db.DeleteAPIKey("no-such-conn"))
}

func TestCreateAPIKey_MultipleConnections(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.CreateAPIKey("conn-a", "hash-a"))
	require.NoError(t, db.CreateAPIKey("conn-b", "hash-b"))

	nameA, err := db.ValidateAPIKey("hash-a")
	require.NoError(t, err)
	assert.Equal(t, "conn-a", nameA)

	nameB, err := db.ValidateAPIKey("hash-b")
	require.NoError(t, err)
	assert.Equal(t, "conn-b", nameB)
}
