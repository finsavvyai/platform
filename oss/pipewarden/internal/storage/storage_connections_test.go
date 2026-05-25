package storage

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSaveConnection_Insert(t *testing.T) {
	db := newTestDB(t)

	rec := &ConnectionRecord{
		Name:     "gh-save",
		Platform: "github",
		Token:    "ghp_secret",
		BaseURL:  "https://api.github.com",
	}
	require.NoError(t, db.SaveConnection(rec))
	assert.NotZero(t, rec.ID)

	got, err := db.GetByName("gh-save")
	require.NoError(t, err)
	assert.Equal(t, "gh-save", got.Name)
	assert.Equal(t, "ghp_secret", got.Token)
}

func TestSaveConnection_Upsert(t *testing.T) {
	db := newTestDB(t)

	rec := &ConnectionRecord{Name: "gh-upsert", Platform: "github", Token: "old-token"}
	require.NoError(t, db.SaveConnection(rec))

	rec.Token = "new-token"
	rec.BaseURL = "https://ghe.example.com"
	require.NoError(t, db.SaveConnection(rec))

	got, err := db.GetByName("gh-upsert")
	require.NoError(t, err)
	assert.Equal(t, "new-token", got.Token)
	assert.Equal(t, "https://ghe.example.com", got.BaseURL)
}

func TestUpdateConnectionHealth_Success(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.Create(&ConnectionRecord{Name: "gh-health", Platform: "github"}))

	verifiedAt := time.Now().UTC()
	require.NoError(t, db.UpdateConnectionHealth("gh-health", "healthy", "user@github.com", verifiedAt))

	got, err := db.GetByName("gh-health")
	require.NoError(t, err)
	assert.Equal(t, "healthy", got.HealthStatus)
	assert.Equal(t, "user@github.com", got.ProviderIdentity)
	assert.NotNil(t, got.LastVerifiedAt)
}

func TestUpdateConnectionHealth_EmptyIdentityPreserved(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.Create(&ConnectionRecord{
		Name:             "gh-idpreserve",
		Platform:         "github",
		ProviderIdentity: "original@github.com",
	}))

	// Pass empty identity — existing value should be preserved
	verifiedAt := time.Now().UTC()
	require.NoError(t, db.UpdateConnectionHealth("gh-idpreserve", "healthy", "", verifiedAt))

	got, err := db.GetByName("gh-idpreserve")
	require.NoError(t, err)
	assert.Equal(t, "original@github.com", got.ProviderIdentity)
}

func TestUpdateConnectionHealth_NotFound(t *testing.T) {
	db := newTestDB(t)

	err := db.UpdateConnectionHealth("nonexistent", "healthy", "", time.Now())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestNormalizeConnection_AuthMethodToken(t *testing.T) {
	db := newTestDB(t)

	rec := &ConnectionRecord{Name: "gh-norm", Platform: "github", Token: "tok"}
	require.NoError(t, db.Create(rec))

	got, err := db.GetByName("gh-norm")
	require.NoError(t, err)
	assert.Equal(t, "token", got.AuthMethod)
	assert.Equal(t, "pending", got.HealthStatus)
}

func TestNormalizeConnection_AuthMethodBasic(t *testing.T) {
	db := newTestDB(t)

	rec := &ConnectionRecord{Name: "bb-basic", Platform: "bitbucket", Username: "user", AppPassword: "pass"}
	require.NoError(t, db.Create(rec))

	got, err := db.GetByName("bb-basic")
	require.NoError(t, err)
	assert.Equal(t, "basic", got.AuthMethod)
}

func TestNormalizeConnection_AuthMethodGitHubApp(t *testing.T) {
	db := newTestDB(t)

	rec := &ConnectionRecord{Name: "gh-app", Platform: "github", InstallationID: 12345}
	require.NoError(t, db.Create(rec))

	got, err := db.GetByName("gh-app")
	require.NoError(t, err)
	assert.Equal(t, "github_app", got.AuthMethod)
}

func TestNewInMemory(t *testing.T) {
	db, err := NewInMemory()
	require.NoError(t, err)
	require.NotNil(t, db)
	defer func() { _ = db.Close() }()

	require.NoError(t, db.Ping())
	assert.Equal(t, EngineSQLite, db.Driver())
}

func TestNewFromConfig_SQLite(t *testing.T) {
	dir := t.TempDir()
	db, err := NewFromConfig(Config{
		Driver:  "sqlite",
		Path:    dir + "/fromcfg.db",
		WALMode: true,
	})
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	assert.Equal(t, EngineSQLite, db.Driver())
	require.NoError(t, db.Ping())
}

func TestDriverAndPing(t *testing.T) {
	db := newTestDB(t)

	assert.Equal(t, EngineSQLite, db.Driver())
	require.NoError(t, db.Ping())
}

func TestResolveDriver(t *testing.T) {
	tests := []struct {
		driver string
		url    string
		host   string
		want   Engine
	}{
		{"sqlite", "", "", EngineSQLite},
		{"sqlite3", "", "", EngineSQLite},
		{"", "", "", EngineSQLite},
		{"postgres", "", "", EnginePostgres},
		{"postgresql", "", "", EnginePostgres},
		{"pgx", "", "", EnginePostgres},
		{"", "postgres://localhost/db", "", EnginePostgres},
		{"", "", "localhost", EnginePostgres},
		{"unknown", "", "", EngineSQLite},
	}
	for _, tc := range tests {
		got := resolveDriver(tc.driver, tc.url, tc.host)
		assert.Equal(t, tc.want, got, "driver=%q url=%q host=%q", tc.driver, tc.url, tc.host)
	}
}

func TestBuildDSN_SQLite_Defaults(t *testing.T) {
	dsn, drv, err := buildDSN(EngineSQLite, Config{})
	require.NoError(t, err)
	assert.Equal(t, "sqlite3", drv)
	assert.Contains(t, dsn, "pipewarden.db")
}

func TestBuildDSN_SQLite_WAL(t *testing.T) {
	dsn, drv, err := buildDSN(EngineSQLite, Config{Path: "/tmp/test.db", WALMode: true})
	require.NoError(t, err)
	assert.Equal(t, "sqlite3", drv)
	assert.Contains(t, dsn, "_journal_mode=WAL")
}

func TestBuildDSN_SQLite_InMemory(t *testing.T) {
	dsn, drv, err := buildDSN(EngineSQLite, Config{Path: ":memory:"})
	require.NoError(t, err)
	assert.Equal(t, "sqlite3", drv)
	assert.Equal(t, ":memory:", dsn)
}

func TestBuildDSN_Postgres_URL(t *testing.T) {
	rawURL := "postgres://user:pass@localhost:5432/mydb"
	dsn, drv, err := buildDSN(EnginePostgres, Config{URL: rawURL})
	require.NoError(t, err)
	assert.Equal(t, "pgx", drv)
	assert.Equal(t, rawURL, dsn)
}

func TestBuildDSN_Postgres_MissingFields(t *testing.T) {
	_, _, err := buildDSN(EnginePostgres, Config{Host: "localhost"}) // missing username+name
	require.Error(t, err)
	assert.Contains(t, err.Error(), "requires host, username, and name")
}

func TestBuildDSN_Postgres_FullConfig(t *testing.T) {
	cfg := Config{
		Host:     "db.example.com",
		Port:     5432,
		Username: "admin",
		Password: "secret",
		Name:     "pipewarden",
		SSLMode:  "require",
	}
	dsn, drv, err := buildDSN(EnginePostgres, cfg)
	require.NoError(t, err)
	assert.Equal(t, "pgx", drv)
	assert.Contains(t, dsn, "db.example.com")
	assert.Contains(t, dsn, "sslmode=require")
}

func TestBuildDSN_Postgres_DefaultPort(t *testing.T) {
	cfg := Config{Host: "localhost", Username: "u", Name: "db"}
	dsn, _, err := buildDSN(EnginePostgres, cfg)
	require.NoError(t, err)
	assert.Contains(t, dsn, ":5432/")
}
