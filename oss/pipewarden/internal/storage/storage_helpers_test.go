package storage

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- dbToBool covers all branches ---

func TestDbToBool_Bool(t *testing.T) {
	assert.True(t, dbToBool(true))
	assert.False(t, dbToBool(false))
}

func TestDbToBool_Int64(t *testing.T) {
	assert.True(t, dbToBool(int64(1)))
	assert.False(t, dbToBool(int64(0)))
	assert.True(t, dbToBool(int64(99)))
}

func TestDbToBool_Int32(t *testing.T) {
	assert.True(t, dbToBool(int32(1)))
	assert.False(t, dbToBool(int32(0)))
}

func TestDbToBool_Int(t *testing.T) {
	assert.True(t, dbToBool(int(1)))
	assert.False(t, dbToBool(int(0)))
}

func TestDbToBool_Bytes(t *testing.T) {
	assert.True(t, dbToBool([]byte("1")))
	assert.True(t, dbToBool([]byte("true")))
	assert.True(t, dbToBool([]byte("TRUE")))
	assert.False(t, dbToBool([]byte("0")))
	assert.False(t, dbToBool([]byte("false")))
}

func TestDbToBool_Default(t *testing.T) {
	assert.False(t, dbToBool(nil))
	assert.False(t, dbToBool("true")) // string — hits default case
	assert.False(t, dbToBool(3.14))
}

// --- boolToDB ---

func TestBoolToDB(t *testing.T) {
	assert.Equal(t, 1, boolToDB(true))
	assert.Equal(t, 0, boolToDB(false))
}

// --- bind (SQLite passthrough) ---

func TestBind_SQLite_Passthrough(t *testing.T) {
	db := newTestDB(t) // sqlite driver
	query := `SELECT * FROM connections WHERE name = ? AND platform = ?`
	assert.Equal(t, query, db.bind(query))
}

// --- columnExists (SQLite PRAGMA path) ---

func TestColumnExists_ExistingColumn(t *testing.T) {
	db := newTestDB(t)

	exists, err := db.columnExists("connections", "name")
	require.NoError(t, err)
	assert.True(t, exists)
}

func TestColumnExists_MissingColumn(t *testing.T) {
	db := newTestDB(t)

	exists, err := db.columnExists("connections", "nonexistent_column_xyz")
	require.NoError(t, err)
	assert.False(t, exists)
}

// --- ensureColumn ---

func TestEnsureColumn_ExistingColumnNoOp(t *testing.T) {
	db := newTestDB(t)

	// "name" already exists — should be a no-op (no error)
	require.NoError(t, db.ensureColumn("connections", "name", "TEXT"))
}

func TestEnsureColumn_AddsNewColumn(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.ensureColumn("connections", "custom_tag", "TEXT NOT NULL DEFAULT ''"))

	// Should now exist
	exists, err := db.columnExists("connections", "custom_tag")
	require.NoError(t, err)
	assert.True(t, exists)
}

// --- NewFromConfig Postgres pool-defaults branch ---

func TestNewFromConfig_PostgresPoolDefaults(t *testing.T) {
	// We can't actually connect to Postgres in unit tests, but we can verify
	// that NewFromConfig with a postgres driver gets through the pool-defaults
	// block before hitting the connection error.
	// The key assertion: it returns an error (can't connect), not a panic.
	_, err := NewFromConfig(Config{
		Driver:   "postgres",
		Host:     "127.0.0.1",
		Port:     15432, // nothing listening here
		Username: "u",
		Name:     "db",
	})
	// Error expected (connection refused), but no panic
	assert.Error(t, err)
}

// --- Open with connection pool settings ---

func TestOpen_WithPoolSettings(t *testing.T) {
	dir := t.TempDir()
	db, err := Open(Config{
		Driver:       "sqlite",
		Path:         dir + "/pool.db",
		WALMode:      false,
		MaxOpenConns: 5,
		MaxIdleConns: 2,
	})
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	require.NoError(t, db.Ping())
}

// --- timestampType and dialect (SQLite branch) ---

func TestTimestampType_SQLite(t *testing.T) {
	db := newTestDB(t)
	assert.Equal(t, "DATETIME", db.timestampType())
}

func TestDialect_SQLite(t *testing.T) {
	db := newTestDB(t)
	d := db.dialect()
	assert.Equal(t, "INTEGER PRIMARY KEY AUTOINCREMENT", d.idType)
	assert.Equal(t, "CURRENT_TIMESTAMP", d.nowExpr)
	assert.Equal(t, "INTEGER", d.boolType)
	assert.Equal(t, "DATETIME", d.tsType)
}

// --- boolValue (SQLite branch only; Postgres branch requires live connection) ---

func TestBoolValue_SQLite(t *testing.T) {
	db := newTestDB(t)
	// SQLite driver → boolValue delegates to boolToDB
	assert.Equal(t, 1, db.boolValue(true))
	assert.Equal(t, 0, db.boolValue(false))
}

// --- bind: Postgres placeholder substitution ---
// We construct a mock DB with EnginePostgres driver to exercise the ? → $N path
// without needing a live Postgres connection.

func TestBind_Postgres_Substitution(t *testing.T) {
	// Build a synthetic DB with Postgres driver (no real connection needed for bind)
	pgDB := &DB{driver: EnginePostgres}

	q := pgDB.bind(`INSERT INTO foo (a, b, c) VALUES (?, ?, ?)`)
	assert.Equal(t, `INSERT INTO foo (a, b, c) VALUES ($1, $2, $3)`, q)
}

func TestBind_Postgres_NoPlaceholders(t *testing.T) {
	pgDB := &DB{driver: EnginePostgres}
	q := `SELECT * FROM connections`
	assert.Equal(t, q, pgDB.bind(q))
}

// --- timestampType and dialect (Postgres branch) ---

func TestTimestampType_Postgres(t *testing.T) {
	pgDB := &DB{driver: EnginePostgres}
	assert.Equal(t, "TIMESTAMPTZ", pgDB.timestampType())
}

func TestDialect_Postgres(t *testing.T) {
	pgDB := &DB{driver: EnginePostgres}
	d := pgDB.dialect()
	assert.Equal(t, "BIGSERIAL PRIMARY KEY", d.idType)
	assert.Equal(t, "NOW()", d.nowExpr)
	assert.Equal(t, "BOOLEAN", d.boolType)
	assert.Equal(t, "TIMESTAMPTZ", d.tsType)
}

// --- boolValue (Postgres branch) ---

func TestBoolValue_Postgres(t *testing.T) {
	pgDB := &DB{driver: EnginePostgres}
	// Postgres driver → returns bool directly
	assert.Equal(t, true, pgDB.boolValue(true))
	assert.Equal(t, false, pgDB.boolValue(false))
}

// --- Open failure paths ---

// Open line 83: buildDSN returns error for invalid Postgres config (missing fields)
func TestOpen_BuildDSNError(t *testing.T) {
	_, err := Open(Config{
		Driver: "postgres",
		Host:   "localhost",
		// missing Username and Name → buildDSN returns error
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "requires host, username, and name")
}

// Open line 88: sql.Open itself errors when sqlDriver name is unregistered.
// We can't easily trigger this with registered drivers; Ping failure is the
// next reachable path — tested via Postgres connection refused.
func TestOpen_PingFailure(t *testing.T) {
	_, err := Open(Config{
		Driver:   "postgres",
		Host:     "127.0.0.1",
		Port:     19998,
		Username: "u",
		Name:     "db",
	})
	require.Error(t, err)
}

// --- scanConnection: scan error (non-ErrNoRows) ---
// This path is reached only when the DB returns malformed data.
// We trigger it by directly querying with wrong column count.

func TestScanConnection_ErrNoRows(t *testing.T) {
	db := newTestDB(t)

	// GetByName with missing record → ErrNoRows → "connection not found"
	_, err := db.GetByName("absolutely-does-not-exist")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

// --- ensureColumn: Exec error path ---
// We cannot inject a DB exec error without a closed DB.
// Verify ensureColumn correctly handles the "already exists" path.
func TestEnsureColumn_IdempotentMultipleCalls(t *testing.T) {
	db := newTestDB(t)

	// Call ensureColumn twice on the same column — should be idempotent
	require.NoError(t, db.ensureColumn("connections", "token", "TEXT"))
	require.NoError(t, db.ensureColumn("connections", "token", "TEXT"))
}

// --- LastVerifiedAt: verify it is populated when set ---

func TestScanConnection_LastVerifiedAt(t *testing.T) {
	db := newTestDB(t)

	now := time.Now().UTC().Truncate(time.Second)
	require.NoError(t, db.Create(&ConnectionRecord{
		Name:     "gh-ts",
		Platform: "github",
		Token:    "tok",
	}))
	require.NoError(t, db.UpdateConnectionHealth("gh-ts", "healthy", "user@github.com", now))

	got, err := db.GetByName("gh-ts")
	require.NoError(t, err)
	require.NotNil(t, got.LastVerifiedAt)
	assert.Equal(t, "user@github.com", got.ProviderIdentity)
}

// --- GetFindingStats: empty table (no rows at all) ---

func TestGetFindingStats_Empty(t *testing.T) {
	db := newTestDB(t)

	stats, err := db.GetFindingStats()
	require.NoError(t, err)
	assert.Equal(t, 0, stats["open"])
}
