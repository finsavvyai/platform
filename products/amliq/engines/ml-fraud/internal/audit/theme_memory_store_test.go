package audit

import (
	"context"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestTheme(id, tenant, name string) *ThemeConfig {
	t := validTheme()
	t.ID = id
	t.TenantID = tenant
	t.Name = name
	return t
}

func TestInMemoryThemeStore_Create(t *testing.T) {
	store := NewInMemoryThemeStore()
	ctx := context.Background()
	theme := newTestTheme("t1", "tenant-1", "My Theme")

	err := store.Create(ctx, theme)
	require.NoError(t, err)

	got, err := store.GetByID(ctx, "tenant-1", "t1")
	require.NoError(t, err)
	assert.Equal(t, "My Theme", got.Name)
	assert.False(t, got.CreatedAt.IsZero())
}

func TestInMemoryThemeStore_Create_Validation(t *testing.T) {
	store := NewInMemoryThemeStore()
	ctx := context.Background()
	theme := newTestTheme("", "tenant-1", "Bad Theme")

	err := store.Create(ctx, theme)
	assert.ErrorIs(t, err, ErrThemeEmptyID)
}

func TestInMemoryThemeStore_GetByID_NotFound(t *testing.T) {
	store := NewInMemoryThemeStore()
	_, err := store.GetByID(context.Background(), "tenant-1", "missing")
	assert.ErrorIs(t, err, ErrThemeNotFound)
}

func TestInMemoryThemeStore_GetByID_WrongTenant(t *testing.T) {
	store := NewInMemoryThemeStore()
	ctx := context.Background()
	require.NoError(t, store.Create(ctx, newTestTheme("t1", "tenant-1", "Theme")))

	_, err := store.GetByID(ctx, "tenant-2", "t1")
	assert.ErrorIs(t, err, ErrThemeNotFound)
}

func TestInMemoryThemeStore_GetByTenant(t *testing.T) {
	store := NewInMemoryThemeStore()
	ctx := context.Background()
	require.NoError(t, store.Create(ctx, newTestTheme("t1", "tenant-1", "A")))
	require.NoError(t, store.Create(ctx, newTestTheme("t2", "tenant-1", "B")))
	require.NoError(t, store.Create(ctx, newTestTheme("t3", "tenant-2", "C")))

	themes, err := store.GetByTenant(ctx, "tenant-1")
	require.NoError(t, err)
	assert.Len(t, themes, 2)
}

func TestInMemoryThemeStore_GetActive_Default(t *testing.T) {
	store := NewInMemoryThemeStore()
	ctx := context.Background()

	theme, err := store.GetActive(ctx, "tenant-1")
	require.NoError(t, err)
	assert.Equal(t, "default", theme.ID)
	assert.Equal(t, "Default", theme.Name)
	assert.True(t, theme.IsActive)
}

func TestInMemoryThemeStore_SetActive(t *testing.T) {
	store := NewInMemoryThemeStore()
	ctx := context.Background()
	require.NoError(t, store.Create(ctx, newTestTheme("t1", "tenant-1", "A")))
	require.NoError(t, store.Create(ctx, newTestTheme("t2", "tenant-1", "B")))

	require.NoError(t, store.SetActive(ctx, "tenant-1", "t1"))

	active, err := store.GetActive(ctx, "tenant-1")
	require.NoError(t, err)
	assert.Equal(t, "t1", active.ID)
	assert.True(t, active.IsActive)

	// Switch to t2
	require.NoError(t, store.SetActive(ctx, "tenant-1", "t2"))
	active, _ = store.GetActive(ctx, "tenant-1")
	assert.Equal(t, "t2", active.ID)

	// Verify t1 is now inactive
	t1, _ := store.GetByID(ctx, "tenant-1", "t1")
	assert.False(t, t1.IsActive)
}

func TestInMemoryThemeStore_Delete(t *testing.T) {
	store := NewInMemoryThemeStore()
	ctx := context.Background()
	require.NoError(t, store.Create(ctx, newTestTheme("t1", "tenant-1", "A")))

	require.NoError(t, store.Delete(ctx, "tenant-1", "t1"))
	_, err := store.GetByID(ctx, "tenant-1", "t1")
	assert.ErrorIs(t, err, ErrThemeNotFound)
}

func TestInMemoryThemeStore_Delete_Active_Fails(t *testing.T) {
	store := NewInMemoryThemeStore()
	ctx := context.Background()
	require.NoError(t, store.Create(ctx, newTestTheme("t1", "tenant-1", "A")))
	require.NoError(t, store.SetActive(ctx, "tenant-1", "t1"))

	err := store.Delete(ctx, "tenant-1", "t1")
	assert.ErrorIs(t, err, ErrThemeDeleteActive)
}

func TestInMemoryThemeStore_Update(t *testing.T) {
	store := NewInMemoryThemeStore()
	ctx := context.Background()
	original := newTestTheme("t1", "tenant-1", "Original")
	require.NoError(t, store.Create(ctx, original))

	updated := newTestTheme("t1", "tenant-1", "Updated")
	require.NoError(t, store.Update(ctx, updated))

	got, _ := store.GetByID(ctx, "tenant-1", "t1")
	assert.Equal(t, "Updated", got.Name)
}

func TestInMemoryThemeStore_ConcurrentAccess(t *testing.T) {
	store := NewInMemoryThemeStore()
	ctx := context.Background()

	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			theme := newTestTheme("t-concurrent", "tenant-1", "Theme")
			theme.ID = "t-concurrent"
			_ = store.Create(ctx, theme)
			_, _ = store.GetByTenant(ctx, "tenant-1")
			_, _ = store.GetActive(ctx, "tenant-1")
		}(i)
	}
	wg.Wait()
}
