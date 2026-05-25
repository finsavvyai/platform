package storage

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInviteMember_Basic(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.InviteMember("alice@example.com", "admin"))

	members, err := db.ListMembers()
	require.NoError(t, err)
	require.Len(t, members, 1)

	m := members[0]
	assert.Equal(t, "alice@example.com", m.Email)
	assert.Equal(t, "admin", m.Role)
	assert.Equal(t, "invited", m.Status)
	assert.Nil(t, m.JoinedAt)
}

func TestInviteMember_Duplicate(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.InviteMember("alice@example.com", "member"))
	err := db.InviteMember("alice@example.com", "admin")
	require.Error(t, err) // UNIQUE constraint on email
}

func TestListMembers_Empty(t *testing.T) {
	db := newTestDB(t)

	members, err := db.ListMembers()
	require.NoError(t, err)
	assert.Empty(t, members)
}

func TestListMembers_Multiple(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.InviteMember("alice@example.com", "admin"))
	require.NoError(t, db.InviteMember("bob@example.com", "member"))
	require.NoError(t, db.InviteMember("carol@example.com", "viewer"))

	members, err := db.ListMembers()
	require.NoError(t, err)
	assert.Len(t, members, 3)
}

func TestRemoveMember_Success(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.InviteMember("alice@example.com", "member"))
	require.NoError(t, db.RemoveMember("alice@example.com"))

	members, err := db.ListMembers()
	require.NoError(t, err)
	assert.Empty(t, members)
}

func TestRemoveMember_NotFound(t *testing.T) {
	db := newTestDB(t)

	err := db.RemoveMember("nobody@example.com")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestUpdateRole_Success(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.InviteMember("alice@example.com", "member"))
	require.NoError(t, db.UpdateRole("alice@example.com", "admin"))

	members, err := db.ListMembers()
	require.NoError(t, err)
	require.Len(t, members, 1)
	assert.Equal(t, "admin", members[0].Role)
}

func TestUpdateRole_NotFound(t *testing.T) {
	db := newTestDB(t)

	err := db.UpdateRole("nobody@example.com", "admin")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestTeam_RoundTrip(t *testing.T) {
	db := newTestDB(t)

	emails := []string{"a@x.com", "b@x.com", "c@x.com"}
	for _, e := range emails {
		require.NoError(t, db.InviteMember(e, "member"))
	}

	require.NoError(t, db.UpdateRole("b@x.com", "admin"))
	require.NoError(t, db.RemoveMember("c@x.com"))

	members, err := db.ListMembers()
	require.NoError(t, err)
	require.Len(t, members, 2)

	roles := map[string]string{}
	for _, m := range members {
		roles[m.Email] = m.Role
	}
	assert.Equal(t, "member", roles["a@x.com"])
	assert.Equal(t, "admin", roles["b@x.com"])
}
