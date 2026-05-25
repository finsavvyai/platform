package storage

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newPolicy(id, name string, builtin bool) PolicyRow {
	return PolicyRow{
		ID:          id,
		Name:        name,
		Description: "test policy",
		Enabled:     true,
		Severity:    "high",
		Pattern:     ".*secret.*",
		Message:     "Secret detected",
		Category:    "secrets",
		IsBuiltin:   builtin,
	}
}

func TestCreatePolicy_Basic(t *testing.T) {
	db := newTestDB(t)

	p := newPolicy("pol-1", "No Secrets", false)
	require.NoError(t, db.CreatePolicy(p))

	got, err := db.GetPolicy("pol-1")
	require.NoError(t, err)
	assert.Equal(t, "pol-1", got.ID)
	assert.Equal(t, "No Secrets", got.Name)
	assert.True(t, got.Enabled)
	assert.False(t, got.IsBuiltin)
}

func TestCreatePolicy_Duplicate(t *testing.T) {
	db := newTestDB(t)

	p := newPolicy("pol-dup", "Dup", false)
	require.NoError(t, db.CreatePolicy(p))
	err := db.CreatePolicy(p)
	require.Error(t, err)
}

func TestGetPolicy_NotFound(t *testing.T) {
	db := newTestDB(t)

	_, err := db.GetPolicy("nonexistent")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestUpdatePolicy_Custom(t *testing.T) {
	db := newTestDB(t)

	p := newPolicy("pol-upd", "Old Name", false)
	require.NoError(t, db.CreatePolicy(p))

	p.Name = "New Name"
	p.Severity = "medium"
	require.NoError(t, db.UpdatePolicy("pol-upd", p))

	got, err := db.GetPolicy("pol-upd")
	require.NoError(t, err)
	assert.Equal(t, "New Name", got.Name)
	assert.Equal(t, "medium", got.Severity)
}

func TestUpdatePolicy_Builtin_Rejected(t *testing.T) {
	db := newTestDB(t)

	p := newPolicy("pol-builtin", "Built-in", true)
	require.NoError(t, db.CreatePolicy(p))

	p.Name = "Hacked"
	err := db.UpdatePolicy("pol-builtin", p)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found or is built-in")
}

func TestUpdatePolicy_NotFound(t *testing.T) {
	db := newTestDB(t)

	err := db.UpdatePolicy("no-such-id", newPolicy("no-such-id", "x", false))
	require.Error(t, err)
}

func TestDeletePolicy_Custom(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.CreatePolicy(newPolicy("pol-del", "Delete Me", false)))
	require.NoError(t, db.DeletePolicy("pol-del"))

	_, err := db.GetPolicy("pol-del")
	require.Error(t, err)
}

func TestDeletePolicy_Builtin_Rejected(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.CreatePolicy(newPolicy("pol-bi", "Built-in", true)))

	err := db.DeletePolicy("pol-bi")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "cannot delete built-in")
}

func TestDeletePolicy_NotFound(t *testing.T) {
	db := newTestDB(t)

	err := db.DeletePolicy("no-such")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestListPolicies(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.CreatePolicy(newPolicy("p1", "Policy 1", false)))
	require.NoError(t, db.CreatePolicy(newPolicy("p2", "Policy 2", true)))
	require.NoError(t, db.CreatePolicy(newPolicy("p3", "Policy 3", false)))

	policies, err := db.ListPolicies()
	require.NoError(t, err)
	assert.Len(t, policies, 3)
}

func TestListPolicies_Empty(t *testing.T) {
	db := newTestDB(t)

	policies, err := db.ListPolicies()
	require.NoError(t, err)
	assert.Empty(t, policies)
}

func TestPolicy_EnabledFlag(t *testing.T) {
	db := newTestDB(t)

	p := newPolicy("pol-dis", "Disabled", false)
	p.Enabled = false
	require.NoError(t, db.CreatePolicy(p))

	got, err := db.GetPolicy("pol-dis")
	require.NoError(t, err)
	assert.False(t, got.Enabled)
}
