package storage

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newSemgrepRule(id, name string, enabled bool) SemgrepRuleRow {
	return SemgrepRuleRow{
		ID:          id,
		Name:        name,
		Description: "detects hardcoded passwords",
		Pattern:     `password = "..."`,
		Language:    "python",
		Severity:    "high",
		Message:     "Hardcoded password detected",
		Enabled:     enabled,
	}
}

func TestCreateSemgrepRule_Basic(t *testing.T) {
	db := newTestDB(t)

	r := newSemgrepRule("rule-1", "Hardcoded Password", true)
	require.NoError(t, db.CreateSemgrepRule(r))

	got, err := db.GetSemgrepRule("rule-1")
	require.NoError(t, err)
	assert.Equal(t, "rule-1", got.ID)
	assert.Equal(t, "Hardcoded Password", got.Name)
	assert.Equal(t, "python", got.Language)
	assert.True(t, got.Enabled)
}

func TestCreateSemgrepRule_Duplicate(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.CreateSemgrepRule(newSemgrepRule("rule-dup", "Dup", true)))
	err := db.CreateSemgrepRule(newSemgrepRule("rule-dup", "Dup Again", true))
	require.Error(t, err)
}

func TestGetSemgrepRule_NotFound(t *testing.T) {
	db := newTestDB(t)

	_, err := db.GetSemgrepRule("no-such-rule")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestListSemgrepRules_Empty(t *testing.T) {
	db := newTestDB(t)

	rules, err := db.ListSemgrepRules()
	require.NoError(t, err)
	assert.Empty(t, rules)
}

func TestListSemgrepRules_Multiple(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.CreateSemgrepRule(newSemgrepRule("r1", "Rule 1", true)))
	require.NoError(t, db.CreateSemgrepRule(newSemgrepRule("r2", "Rule 2", false)))
	require.NoError(t, db.CreateSemgrepRule(newSemgrepRule("r3", "Rule 3", true)))

	rules, err := db.ListSemgrepRules()
	require.NoError(t, err)
	assert.Len(t, rules, 3)
}

func TestDeleteSemgrepRule(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.CreateSemgrepRule(newSemgrepRule("rule-del", "Delete Me", true)))
	require.NoError(t, db.DeleteSemgrepRule("rule-del"))

	_, err := db.GetSemgrepRule("rule-del")
	require.Error(t, err)
}

func TestDeleteSemgrepRule_NotFound(t *testing.T) {
	db := newTestDB(t)

	err := db.DeleteSemgrepRule("no-such-rule")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestSemgrepRule_EnabledFalse(t *testing.T) {
	db := newTestDB(t)

	r := newSemgrepRule("rule-dis", "Disabled Rule", false)
	require.NoError(t, db.CreateSemgrepRule(r))

	got, err := db.GetSemgrepRule("rule-dis")
	require.NoError(t, err)
	assert.False(t, got.Enabled)
}
