package onboarding

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func validSessionWithID(id string) *OnboardingSession {
	return &OnboardingSession{
		ID:          id,
		OrgName:     "Acme Corp",
		AdminEmail:  "admin@acme.com",
		CurrentStep: StepOrgSetup,
		Status:      StatusInProgress,
	}
}

func TestCreate_StoresSessionAndSetsID(t *testing.T) {
	repo := NewInMemoryOnboardingRepository()
	s := &OnboardingSession{
		OrgName:    "TestOrg",
		AdminEmail: "test@org.com",
		Status:     StatusInProgress,
	}

	err := repo.Create(context.Background(), s)
	require.NoError(t, err)
	assert.NotEmpty(t, s.ID, "ID should be auto-generated")
	assert.False(t, s.CreatedAt.IsZero(), "CreatedAt should be set")
	assert.False(t, s.UpdatedAt.IsZero(), "UpdatedAt should be set")

	got, err := repo.Get(context.Background(), s.ID)
	require.NoError(t, err)
	assert.Equal(t, "TestOrg", got.OrgName)
}

func TestCreate_RejectsDuplicateID(t *testing.T) {
	repo := NewInMemoryOnboardingRepository()
	s := validSessionWithID("dup-id")

	require.NoError(t, repo.Create(context.Background(), s))

	s2 := validSessionWithID("dup-id")
	err := repo.Create(context.Background(), s2)
	assert.ErrorIs(t, err, ErrSessionAlreadyExists)
}

func TestCreate_ValidationError(t *testing.T) {
	repo := NewInMemoryOnboardingRepository()
	s := &OnboardingSession{ID: "v1"}

	err := repo.Create(context.Background(), s)
	assert.ErrorIs(t, err, ErrMissingOrgName)
}

func TestGet_ReturnsSession(t *testing.T) {
	repo := NewInMemoryOnboardingRepository()
	s := validSessionWithID("get-1")
	require.NoError(t, repo.Create(context.Background(), s))

	got, err := repo.Get(context.Background(), "get-1")
	require.NoError(t, err)
	assert.Equal(t, "Acme Corp", got.OrgName)
}

func TestGet_ReturnsErrSessionNotFound(t *testing.T) {
	repo := NewInMemoryOnboardingRepository()

	_, err := repo.Get(context.Background(), "nonexistent")
	assert.ErrorIs(t, err, ErrSessionNotFound)
}

func TestUpdate_ModifiesSession(t *testing.T) {
	repo := NewInMemoryOnboardingRepository()
	s := validSessionWithID("upd-1")
	require.NoError(t, repo.Create(context.Background(), s))

	got, _ := repo.Get(context.Background(), "upd-1")
	got.Status = StatusCompleted
	now := time.Now().UTC()
	got.CompletedAt = &now

	err := repo.Update(context.Background(), got)
	require.NoError(t, err)

	updated, _ := repo.Get(context.Background(), "upd-1")
	assert.Equal(t, StatusCompleted, updated.Status)
	assert.NotNil(t, updated.CompletedAt)
}

func TestUpdate_ReturnsErrorForNonexistent(t *testing.T) {
	repo := NewInMemoryOnboardingRepository()
	s := validSessionWithID("no-exist")

	err := repo.Update(context.Background(), s)
	assert.ErrorIs(t, err, ErrSessionNotFound)
}

func TestList_Pagination(t *testing.T) {
	repo := NewInMemoryOnboardingRepository()
	ctx := context.Background()

	for i := 0; i < 5; i++ {
		s := validSessionWithID("")
		s.OrgName = "Org"
		s.AdminEmail = "a@b.com"
		require.NoError(t, repo.Create(ctx, s))
		time.Sleep(time.Millisecond)
	}

	page, total, err := repo.List(ctx, 2, 0)
	require.NoError(t, err)
	assert.Equal(t, 5, total)
	assert.Len(t, page, 2)

	page2, total2, err := repo.List(ctx, 2, 2)
	require.NoError(t, err)
	assert.Equal(t, 5, total2)
	assert.Len(t, page2, 2)

	page3, _, err := repo.List(ctx, 2, 4)
	require.NoError(t, err)
	assert.Len(t, page3, 1)
}

func TestList_OffsetBeyondTotal(t *testing.T) {
	repo := NewInMemoryOnboardingRepository()
	s := validSessionWithID("")
	s.OrgName = "X"
	s.AdminEmail = "x@x.com"
	require.NoError(t, repo.Create(context.Background(), s))

	page, total, err := repo.List(context.Background(), 10, 100)
	require.NoError(t, err)
	assert.Equal(t, 1, total)
	assert.Empty(t, page)
}

func TestList_EmptyRepository(t *testing.T) {
	repo := NewInMemoryOnboardingRepository()

	page, total, err := repo.List(context.Background(), 10, 0)
	require.NoError(t, err)
	assert.Equal(t, 0, total)
	assert.Empty(t, page)
}

func TestGetAnalytics_MixedStatuses(t *testing.T) {
	repo := NewInMemoryOnboardingRepository()
	ctx := context.Background()

	// Completed session
	s1 := validSessionWithID("a1")
	require.NoError(t, repo.Create(ctx, s1))
	s1g, _ := repo.Get(ctx, "a1")
	s1g.Status = StatusCompleted
	completed := s1g.CreatedAt.Add(30 * time.Minute)
	s1g.CompletedAt = &completed
	require.NoError(t, repo.Update(ctx, s1g))

	// Abandoned at API_KEYS step
	s2 := validSessionWithID("a2")
	s2.AdminEmail = "b@b.com"
	require.NoError(t, repo.Create(ctx, s2))
	s2g, _ := repo.Get(ctx, "a2")
	s2g.Status = StatusAbandoned
	s2g.CurrentStep = StepAPIKeys
	require.NoError(t, repo.Update(ctx, s2g))

	// In-progress session
	s3 := validSessionWithID("a3")
	s3.AdminEmail = "c@c.com"
	require.NoError(t, repo.Create(ctx, s3))

	analytics, err := repo.GetAnalytics(ctx)
	require.NoError(t, err)
	assert.Equal(t, 3, analytics.TotalSessions)
	assert.Equal(t, 1, analytics.CompletedSessions)
	assert.Equal(t, 1, analytics.AbandonedSessions)
	assert.InDelta(t, 30.0, analytics.AvgCompletionMinutes, 0.1)
	assert.Equal(t, 1, analytics.DropOffByStep[StepAPIKeys])
}

func TestGetAnalytics_EmptyRepo(t *testing.T) {
	repo := NewInMemoryOnboardingRepository()

	analytics, err := repo.GetAnalytics(context.Background())
	require.NoError(t, err)
	assert.Equal(t, 0, analytics.TotalSessions)
	assert.Equal(t, float64(0), analytics.AvgCompletionMinutes)
}

// Verify InMemoryOnboardingRepository satisfies the interface.
var _ OnboardingRepository = (*InMemoryOnboardingRepository)(nil)
