package memstore

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/finsavvyai/sdlc-gateway/internal/scim"
)

func newUser(tenant, name string) scim.User {
	return scim.User{
		Schemas:  []string{scim.UserSchema},
		TenantID: tenant,
		UserName: name,
		Active:   true,
	}
}

func TestCreate_AssignsIDAndMeta(t *testing.T) {
	s := NewSCIMStore()
	u, err := s.Create(context.Background(), newUser("acme", "alice"))
	require.NoError(t, err)
	assert.NotEmpty(t, u.ID)
	assert.Equal(t, "User", u.Meta.ResourceType)
	assert.False(t, u.Meta.Created.IsZero())
}

func TestCreate_RejectsDuplicateUserName(t *testing.T) {
	s := NewSCIMStore()
	_, err := s.Create(context.Background(), newUser("acme", "alice"))
	require.NoError(t, err)
	_, err = s.Create(context.Background(), newUser("acme", "ALICE"))
	assert.ErrorIs(t, err, scim.ErrConflict)
}

func TestCreate_AllowsSameUserNameAcrossTenants(t *testing.T) {
	s := NewSCIMStore()
	_, err := s.Create(context.Background(), newUser("acme", "alice"))
	require.NoError(t, err)
	_, err = s.Create(context.Background(), newUser("globex", "alice"))
	assert.NoError(t, err)
}

func TestGet_NotFoundOnUnknownTenant(t *testing.T) {
	s := NewSCIMStore()
	_, err := s.Get(context.Background(), "ghost", "x")
	assert.ErrorIs(t, err, scim.ErrNotFound)
}

func TestGet_NotFoundOnUnknownID(t *testing.T) {
	s := NewSCIMStore()
	_, _ = s.Create(context.Background(), newUser("acme", "alice"))
	_, err := s.Get(context.Background(), "acme", "missing")
	assert.ErrorIs(t, err, scim.ErrNotFound)
}

func TestGet_ReturnsCreated(t *testing.T) {
	s := NewSCIMStore()
	created, _ := s.Create(context.Background(), newUser("acme", "alice"))
	got, err := s.Get(context.Background(), "acme", created.ID)
	require.NoError(t, err)
	assert.Equal(t, "alice", got.UserName)
}

func TestDelete_RemovesUser(t *testing.T) {
	s := NewSCIMStore()
	created, _ := s.Create(context.Background(), newUser("acme", "alice"))
	require.NoError(t, s.Delete(context.Background(), "acme", created.ID))
	_, err := s.Get(context.Background(), "acme", created.ID)
	assert.ErrorIs(t, err, scim.ErrNotFound)
}

func TestDelete_NotFound(t *testing.T) {
	s := NewSCIMStore()
	err := s.Delete(context.Background(), "ghost", "x")
	assert.ErrorIs(t, err, scim.ErrNotFound)

	_, _ = s.Create(context.Background(), newUser("acme", "alice"))
	err = s.Delete(context.Background(), "acme", "missing")
	assert.ErrorIs(t, err, scim.ErrNotFound)
}

func TestUpdate_PreservesCreatedAndBumpsModified(t *testing.T) {
	s := NewSCIMStore()
	created, _ := s.Create(context.Background(), newUser("acme", "alice"))

	updated := created
	updated.UserName = "alice2"
	got, err := s.Update(context.Background(), updated)
	require.NoError(t, err)
	assert.Equal(t, created.Meta.Created, got.Meta.Created)
	assert.True(t, got.Meta.LastModified.After(created.Meta.Created) ||
		got.Meta.LastModified.Equal(created.Meta.Created))
	assert.Equal(t, "alice2", got.UserName)
}

func TestUpdate_NotFound(t *testing.T) {
	s := NewSCIMStore()
	_, err := s.Update(context.Background(), scim.User{TenantID: "ghost", ID: "x"})
	assert.True(t, errors.Is(err, scim.ErrNotFound))

	_, _ = s.Create(context.Background(), newUser("acme", "alice"))
	_, err = s.Update(context.Background(), scim.User{TenantID: "acme", ID: "missing"})
	assert.True(t, errors.Is(err, scim.ErrNotFound))
}

func TestSearch_FiltersByUserName(t *testing.T) {
	s := NewSCIMStore()
	_, _ = s.Create(context.Background(), newUser("acme", "alice"))
	_, _ = s.Create(context.Background(), newUser("acme", "bob"))

	got, total, err := s.Search(context.Background(), "acme", scim.Filter{UserNameEq: "alice"})
	require.NoError(t, err)
	assert.Len(t, got, 1)
	assert.Equal(t, 1, total)
	assert.Equal(t, "alice", got[0].UserName)
}

func TestSearch_PaginatesAndReturnsTotal(t *testing.T) {
	s := NewSCIMStore()
	for _, name := range []string{"a", "b", "c", "d", "e"} {
		_, _ = s.Create(context.Background(), newUser("acme", name))
	}

	got, total, err := s.Search(context.Background(), "acme", scim.Filter{Start: 1, Count: 2})
	require.NoError(t, err)
	assert.Len(t, got, 2)
	assert.Equal(t, 5, total)
}

func TestSearch_StartBeyondTotalReturnsEmpty(t *testing.T) {
	s := NewSCIMStore()
	_, _ = s.Create(context.Background(), newUser("acme", "alice"))

	got, total, err := s.Search(context.Background(), "acme", scim.Filter{Start: 99, Count: 10})
	require.NoError(t, err)
	assert.Empty(t, got)
	assert.Equal(t, 1, total)
}

func TestSearch_UnknownTenantReturnsEmpty(t *testing.T) {
	s := NewSCIMStore()
	got, total, err := s.Search(context.Background(), "ghost", scim.Filter{})
	require.NoError(t, err)
	assert.Empty(t, got)
	assert.Equal(t, 0, total)
}
