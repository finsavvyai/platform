package storage

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEnsureSQLiteParentDir_CreatesNested(t *testing.T) {
	root := t.TempDir()
	target := filepath.Join(root, "deeply", "nested", "pipewarden.db")
	require.NoError(t, ensureSQLiteParentDir(target))
	info, err := os.Stat(filepath.Dir(target))
	require.NoError(t, err)
	assert.True(t, info.IsDir())
}

func TestEnsureSQLiteParentDir_StripsQueryAndFilePrefix(t *testing.T) {
	root := t.TempDir()
	dsn := "file:" + filepath.Join(root, "sub", "pw.db") + "?_journal_mode=WAL"
	require.NoError(t, ensureSQLiteParentDir(dsn))
	_, err := os.Stat(filepath.Join(root, "sub"))
	require.NoError(t, err)
}

func TestEnsureSQLiteParentDir_SkipsMemoryAndEmpty(t *testing.T) {
	assert.NoError(t, ensureSQLiteParentDir(""))
	assert.NoError(t, ensureSQLiteParentDir(":memory:"))
	assert.NoError(t, ensureSQLiteParentDir("file::memory:?cache=shared"))
	assert.NoError(t, ensureSQLiteParentDir("pipewarden.db"))
}

func TestOpen_SQLite_CreatesParentDir(t *testing.T) {
	root := t.TempDir()
	target := filepath.Join(root, "newsubdir", "pw.db")
	db, err := Open(Config{Driver: "sqlite", Path: target})
	require.NoError(t, err)
	defer func() { _ = db.Close() }()
	_, err = os.Stat(filepath.Join(root, "newsubdir"))
	require.NoError(t, err)
}
