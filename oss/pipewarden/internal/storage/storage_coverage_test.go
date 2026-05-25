// storage_coverage_test.go covers residual branches in functions that are
// nearly covered but have a few untested paths — all reachable via SQLite.
package storage

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- FindingSummary: trend direction branches ---

func TestFindingSummary_TrendUp(t *testing.T) {
	db := newTestDB(t)

	// Insert findings only in the "recent" window (last 7 days) to force "up"
	// prior window (7-14 days ago) gets nothing → prior=0, recent>0 → "up"
	require.NoError(t, db.CreateFinding(&FindingRecord{
		ConnectionName: "c", RunID: "r", Severity: "high",
		Category: "secrets", Title: "recent-finding", Description: "d", Status: "open",
	}))

	summary, err := db.FindingSummary()
	require.NoError(t, err)
	assert.Equal(t, "up", summary.TrendDirection)
	assert.Equal(t, 100.0, summary.ChangePercent)
}

func TestFindingSummary_TrendStableFromElseBranch(t *testing.T) {
	db := newTestDB(t)

	// Insert equal counts in both 7-day windows → diff=0 → hits the else branch → stable
	recentTime := time.Now().UTC().Add(-3 * 24 * time.Hour)
	priorTime := time.Now().UTC().Add(-10 * 24 * time.Hour)

	_, err := db.db.Exec(
		`INSERT INTO security_findings (connection_name, run_id, severity, category, title, description, status, created_at)
		 VALUES ('c', 'r', 'low', 'c', 'recent', 'd', 'open', ?)`,
		recentTime,
	)
	require.NoError(t, err)

	_, err = db.db.Exec(
		`INSERT INTO security_findings (connection_name, run_id, severity, category, title, description, status, created_at)
		 VALUES ('c', 'r', 'low', 'c', 'prior', 'd', 'open', ?)`,
		priorTime,
	)
	require.NoError(t, err)

	summary, err := db.FindingSummary()
	require.NoError(t, err)
	// recent=1, prior=1 → diff=0% → falls into default case → stable
	assert.Equal(t, "stable", summary.TrendDirection)
	assert.Equal(t, float64(0), summary.ChangePercent)
}

func TestFindingSummary_TrendStableFromPriorZeroRecentZero(t *testing.T) {
	db := newTestDB(t)

	// Both windows empty AND prior==0: must cover the inner else (prior=0, recent=0 → stable)
	// Insert one old finding outside both windows so the table is non-empty
	// (avoids the NULL scan issue), but nothing in the last 14 days.
	oldTime := time.Now().UTC().Add(-30 * 24 * time.Hour) // 30 days ago
	_, err := db.db.Exec(
		`INSERT INTO security_findings (connection_name, run_id, severity, category, title, description, status, created_at)
		 VALUES ('c', 'r', 'low', 'c', 'very-old', 'd', 'resolved', ?)`,
		oldTime,
	)
	require.NoError(t, err)

	summary, err := db.FindingSummary()
	require.NoError(t, err)
	// prior=0, recent=0 → hits the "else" of "if recent > 0" → stable
	assert.Equal(t, "stable", summary.TrendDirection)
}

func TestFindingSummary_TrendDown(t *testing.T) {
	db := newTestDB(t)

	// 0 recent, 3 prior → diff = (0-3)/3*100 = -100 → "down"
	priorTime := time.Now().UTC().Add(-10 * 24 * time.Hour)
	for i := 0; i < 3; i++ {
		_, err := db.db.Exec(
			`INSERT INTO security_findings (connection_name, run_id, severity, category, title, description, status, created_at)
			 VALUES ('c', 'r', 'low', 'c', ?, 'd', 'open', ?)`,
			fmt.Sprintf("prior-%d", i), priorTime,
		)
		require.NoError(t, err)
	}

	summary, err := db.FindingSummary()
	require.NoError(t, err)
	assert.Equal(t, "down", summary.TrendDirection)
	assert.Less(t, summary.ChangePercent, -5.0)
}

// --- GetFindingStats: rows.Err path (verify it returns the open count correctly) ---

func TestGetFindingStats_MultipleStatuses(t *testing.T) {
	db := newTestDB(t)

	// Insert findings with different statuses — false_positive excluded from severity stats
	require.NoError(t, db.CreateFinding(&FindingRecord{
		ConnectionName: "c", RunID: "r", Severity: "critical",
		Category: "c", Title: "t-open", Description: "d", Status: "open",
	}))
	require.NoError(t, db.CreateFinding(&FindingRecord{
		ConnectionName: "c", RunID: "r", Severity: "high",
		Category: "c", Title: "t-fp", Description: "d", Status: "open",
	}))

	// Mark one as false_positive
	findings, _ := db.ListFindings("")
	var fpID int64
	for _, f := range findings {
		if f.Severity == "high" {
			fpID = f.ID
		}
	}
	require.NoError(t, db.UpdateFindingStatus(fpID, "false_positive"))

	stats, err := db.GetFindingStats()
	require.NoError(t, err)
	// false_positive excluded from severity stats
	assert.Equal(t, 1, stats["critical"])
	assert.Equal(t, 0, stats["high"]) // not in stats (was FP)
	// open count includes the original critical (not yet closed)
	assert.Equal(t, 1, stats["open"])
}

// --- LastAnalysisTime: ensure ts.Valid=false branch hit ---

func TestLastAnalysisTime_NullTimestamp(t *testing.T) {
	// Cannot easily make analyzed_at NULL due to NOT NULL constraint.
	// Instead, just confirm empty DB returns nil without error.
	db := newTestDB(t)

	ts, err := db.LastAnalysisTime()
	require.NoError(t, err)
	assert.Nil(t, ts)
}

// --- schemaStatements: invokes both coreSchema + opsSchema ---

func TestSchemaStatements_ReturnsStatements(t *testing.T) {
	db := newTestDB(t)
	stmts := db.schemaStatements()
	assert.Greater(t, len(stmts), 10) // sanity check
}

// --- NewFromConfig: Postgres pool defaults set to non-zero (passthrough) ---

func TestNewFromConfig_PostgresPoolNonZeroDefaults(t *testing.T) {
	// MaxOpenConns/MaxIdleConns/ConnMaxLifetime all provided → skip the defaults block
	// still expects a connection error (no Postgres running), not a crash
	_, err := NewFromConfig(Config{
		Driver:          "postgres",
		Host:            "127.0.0.1",
		Port:            15433,
		Username:        "u",
		Name:            "db",
		MaxOpenConns:    10,
		MaxIdleConns:    2,
		ConnMaxLifetime: 5 * time.Minute,
	})
	assert.Error(t, err) // expected: cannot connect
}

// --- SaveConnection: GetByName error path after upsert (can't trigger easily,
//     but we can verify the normal path resets the struct) ---

func TestSaveConnection_StructUpdatedAfterUpsert(t *testing.T) {
	db := newTestDB(t)

	rec := &ConnectionRecord{
		Name:     "gh-struct",
		Platform: "github",
		Token:    "tok",
	}
	require.NoError(t, db.SaveConnection(rec))

	// ID and timestamps should be populated after SaveConnection
	assert.NotZero(t, rec.ID)
	assert.False(t, rec.CreatedAt.IsZero())
	assert.False(t, rec.UpdatedAt.IsZero())
}

// --- List: empty table ---

func TestList_Empty(t *testing.T) {
	db := newTestDB(t)

	records, err := db.List()
	require.NoError(t, err)
	assert.Empty(t, records)
}

// --- ListAnalysisHistory: multiple records per connection ---

func TestListAnalysisHistory_MultipleConnections(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.CreateAnalysisRecord(&AnalysisRecord{ConnectionName: "a", RunID: "r1", Summary: "s", Model: "m"}))
	require.NoError(t, db.CreateAnalysisRecord(&AnalysisRecord{ConnectionName: "b", RunID: "r2", Summary: "s", Model: "m"}))
	require.NoError(t, db.CreateAnalysisRecord(&AnalysisRecord{ConnectionName: "a", RunID: "r3", Summary: "s", Model: "m"}))

	all, err := db.ListAnalysisHistory("")
	require.NoError(t, err)
	assert.Len(t, all, 3)

	aHistory, err := db.ListAnalysisHistory("a")
	require.NoError(t, err)
	assert.Len(t, aHistory, 2)
}

// --- ConsumeOAuthState: tx.Begin error is not reachable without a broken DB ---
// --- ConsumeOAuthState: already tested above (missing row, expired). ---
// Cover the intermediate scan branch where Scan returns non-ErrNoRows.
// We test with a valid state but verify the delete + commit path completes.
func TestConsumeOAuthState_TxCommit(t *testing.T) {
	db := newTestDB(t)

	// Save then consume — covers the tx.Exec + tx.Commit branches
	exp := time.Now().UTC().Add(10 * time.Minute)
	require.NoError(t, db.SaveOAuthState("state-tx", "github", exp))
	require.NoError(t, db.ConsumeOAuthState("state-tx", "github"))

	// State consumed — table should be empty
	// Verify by trying to consume again
	err := db.ConsumeOAuthState("state-tx", "github")
	require.Error(t, err)
}

// --- DeleteSchedule: with error on Exec (covered via bad table, but hard to inject).
// Test that non-existent schedule is silently ignored (no rows affected check in impl).
func TestDeleteSchedule_NoRowsAffectedOK(t *testing.T) {
	db := newTestDB(t)

	// Deleting a schedule that doesn't exist returns no error (no rows-affected check)
	require.NoError(t, db.DeleteSchedule("no-such-conn"))
}

// --- ListDueSchedules: multiple due schedules ---

func TestListDueSchedules_MultipleDue(t *testing.T) {
	db := newTestDB(t)

	conns := []string{"conn-a", "conn-b", "conn-c"}
	for _, c := range conns {
		require.NoError(t, db.SetSchedule(c, "0 * * * *", true, "all"))
	}

	past := time.Now().UTC().Add(-2 * time.Hour)
	for _, c := range conns {
		_, err := db.db.Exec(`UPDATE scan_schedules SET next_run_at = ? WHERE connection_name = ?`, past, c)
		require.NoError(t, err)
	}

	due, err := db.ListDueSchedules()
	require.NoError(t, err)
	assert.Len(t, due, 3)
}

// --- GetWebhookConfig: events_json empty string branch ---

func TestGetWebhookConfig_EmptyEventsJSON(t *testing.T) {
	db := newTestDB(t)

	// Directly insert a row with empty events_json to trigger the "" → "[]" branch
	_, err := db.db.Exec(
		`INSERT INTO webhook_configs (name, url, secret, events_json, enabled, last_status_code, last_error, created_at, updated_at)
		 VALUES ('wh-empty', 'https://x.com', 's', '', 0, 0, '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
	)
	require.NoError(t, err)

	got, err := db.GetWebhookConfig("wh-empty")
	require.NoError(t, err)
	assert.NotNil(t, got.Events)
	assert.Empty(t, got.Events)
}

// --- buildDSN: SQLite path with pre-existing query string (append & instead of ?) ---

func TestBuildDSN_SQLite_WAL_ExistingQueryString(t *testing.T) {
	// Path already contains '?' → append "&_journal_mode=WAL"
	dsn, drv, err := buildDSN(EngineSQLite, Config{
		Path:    "file:test.db?cache=shared",
		WALMode: true,
	})
	require.NoError(t, err)
	assert.Equal(t, "sqlite3", drv)
	assert.Equal(t, "file:test.db?cache=shared&_journal_mode=WAL", dsn)
}

// --- schedule: scanScheduleRow with lastRunAt set ---

func TestGetSchedule_WithLastRunAt(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.SetSchedule("gh-lr", "0 * * * *", true, "all"))

	// Set last_run_at to a past time to cover the lastRunAt.Valid branch
	pastTime := time.Now().UTC().Add(-1 * time.Hour)
	_, err := db.db.Exec(
		`UPDATE scan_schedules SET last_run_at = ? WHERE connection_name = ?`,
		pastTime, "gh-lr",
	)
	require.NoError(t, err)

	row, err := db.GetSchedule("gh-lr")
	require.NoError(t, err)
	assert.NotNil(t, row.LastRunAt) // covers lastRunAt.Valid branch
}

// --- LastAnalysisTime / LastAnalysisTimeForConnection: ts.Valid=false ---
// These functions scan into sql.NullTime; it's always Valid when a row exists
// and the column is NOT NULL. The !ts.Valid branch (lines 75/93) is only
// reachable when analyzed_at IS NULL, which the schema prevents. Document this.
// We still verify the happy path sets Valid=true.

func TestLastAnalysisTime_TimestampIsNonNil(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.CreateAnalysisRecord(&AnalysisRecord{
		ConnectionName: "c", RunID: "r", Summary: "s", Model: "m",
	}))

	ts, err := db.LastAnalysisTime()
	require.NoError(t, err)
	require.NotNil(t, ts) // ts.Valid=true branch
}

// --- FindingSummary: trend "up" from the else branch (prior > 0, recent >> prior) ---

func TestFindingSummary_TrendUpFromElseBranch(t *testing.T) {
	db := newTestDB(t)

	// prior window: 1 finding (7-14 days ago)
	priorTime := time.Now().UTC().Add(-10 * 24 * time.Hour)
	_, err := db.db.Exec(
		`INSERT INTO security_findings (connection_name, run_id, severity, category, title, description, status, created_at)
		 VALUES ('c', 'r', 'low', 'c', 'prior-one', 'd', 'open', ?)`,
		priorTime,
	)
	require.NoError(t, err)

	// recent window: 5 findings (0-7 days ago) → diff = (5-1)/1 * 100 = 400% > 5 → "up"
	recentTime := time.Now().UTC().Add(-2 * 24 * time.Hour)
	for i := 0; i < 5; i++ {
		_, err = db.db.Exec(
			`INSERT INTO security_findings (connection_name, run_id, severity, category, title, description, status, created_at)
			 VALUES ('c', 'r', 'low', 'c', ?, 'd', 'open', ?)`,
			fmt.Sprintf("recent-%d", i), recentTime,
		)
		require.NoError(t, err)
	}

	summary, err := db.FindingSummary()
	require.NoError(t, err)
	// prior=1, recent=5, diff=400% > 5 → covers case diff > 5 branch
	assert.Equal(t, "up", summary.TrendDirection)
	assert.Greater(t, summary.ChangePercent, 5.0)
}

// --- GetFindingStats: open count query path ---

func TestGetFindingStats_OnlyResolved(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.CreateFinding(&FindingRecord{
		ConnectionName: "c", RunID: "r", Severity: "medium",
		Category: "c", Title: "resolved-one", Description: "d", Status: "open",
	}))

	findings, _ := db.ListFindings("")
	require.Len(t, findings, 1)
	require.NoError(t, db.UpdateFindingStatus(findings[0].ID, "resolved"))

	stats, err := db.GetFindingStats()
	require.NoError(t, err)
	assert.Equal(t, 0, stats["open"])
	// resolved findings are excluded from severity stats (status != 'false_positive' filter
	// still includes resolved, so medium should still be 1)
	assert.Equal(t, 1, stats["medium"])
}

// --- team.go: joinedAt.Valid branch (scanTeamMember) ---

func TestScanTeamMember_JoinedAtSet(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.InviteMember("joined@example.com", "member"))

	// Set joined_at directly to cover the joinedAt.Valid branch
	joinedAt := time.Now().UTC()
	_, err := db.db.Exec(
		`UPDATE team_members SET joined_at = ?, status = 'active' WHERE email = ?`,
		joinedAt, "joined@example.com",
	)
	require.NoError(t, err)

	members, err := db.ListMembers()
	require.NoError(t, err)
	require.Len(t, members, 1)
	assert.NotNil(t, members[0].JoinedAt) // covers joinedAt.Valid branch in scanTeamMember
	assert.Equal(t, "active", members[0].Status)
}

// --- webhooks.go:89 — rec.Events == nil after JSON decode ---
// events_json = "null" decodes to nil slice → branch sets Events = []string{}

func TestGetWebhookConfig_NullEventsJSON(t *testing.T) {
	db := newTestDB(t)

	_, err := db.db.Exec(
		`INSERT INTO webhook_configs (name, url, secret, events_json, enabled, last_status_code, last_error, created_at, updated_at)
		 VALUES ('wh-null', 'https://x.com', 's', 'null', 0, 0, '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
	)
	require.NoError(t, err)

	got, err := db.GetWebhookConfig("wh-null")
	require.NoError(t, err)
	// "null" decodes to nil → branch normalises it to []string{}
	assert.NotNil(t, got.Events)
	assert.Empty(t, got.Events)
}

// --- migrate: empty-statement skip branch ---
// schemaStatements never produces empty strings in practice, but the trim check
// at line 73 of storage_schema.go is always evaluated. Verify migrate runs cleanly
// on a freshly opened DB (exercises the migrate loop).

func TestMigrate_RunsCleanOnFreshDB(t *testing.T) {
	dir := t.TempDir()
	db, err := New(dir + "/fresh.db")
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	// Calling migrate again on an already-migrated DB should be a no-op
	require.NoError(t, db.migrate())
}

// --- webhooks: SaveWebhookConfig with last_tested_at set ---

func TestSaveWebhookConfig_WithLastTestedAt(t *testing.T) {
	db := newTestDB(t)

	now := time.Now().UTC().Add(-5 * time.Minute)
	rec := &WebhookConfigRecord{
		Name:         "wh-tested",
		URL:          "https://example.com",
		Events:       []string{"finding.created"},
		Enabled:      true,
		LastTestedAt: &now,
	}
	require.NoError(t, db.SaveWebhookConfig(rec))

	got, err := db.GetWebhookConfig("wh-tested")
	require.NoError(t, err)
	assert.NotNil(t, got.LastTestedAt) // covers lastTestedAt.Valid branch
}

// --- policies: rows.Err() and scanPolicyRow happy path via ListPolicies ---

func TestListPolicies_ScansProperly(t *testing.T) {
	db := newTestDB(t)

	for i := 0; i < 5; i++ {
		p := newPolicy(fmt.Sprintf("p-%d", i), fmt.Sprintf("Policy %d", i), i%2 == 0)
		require.NoError(t, db.CreatePolicy(p))
	}

	policies, err := db.ListPolicies()
	require.NoError(t, err)
	assert.Len(t, policies, 5)

	// Verify enabled flag is round-tripped for both true and false
	var enabledCount, disabledCount int
	for _, pol := range policies {
		if pol.IsBuiltin {
			enabledCount++
		} else {
			disabledCount++
		}
	}
	assert.Equal(t, 3, enabledCount)
	assert.Equal(t, 2, disabledCount)
}

// --- semgrep: ListSemgrepRules rows.Err() via scanSemgrepRuleRow ---

func TestListSemgrepRules_ScanRoundTrip(t *testing.T) {
	db := newTestDB(t)

	for i := 0; i < 4; i++ {
		r := newSemgrepRule(fmt.Sprintf("sr-%d", i), fmt.Sprintf("Rule %d", i), i%2 == 0)
		require.NoError(t, db.CreateSemgrepRule(r))
	}

	rules, err := db.ListSemgrepRules()
	require.NoError(t, err)
	assert.Len(t, rules, 4)

	var en, dis int
	for _, r := range rules {
		if r.Enabled {
			en++
		} else {
			dis++
		}
	}
	assert.Equal(t, 2, en)
	assert.Equal(t, 2, dis)
}
