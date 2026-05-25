package projects

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
)

// RemoveMember satisfies Repository for the fakeRepo defined in service_test.go.
func (f *fakeRepo) RemoveMember(_ context.Context, _, projectID, userID uuid.UUID) error {
	ms := f.members[projectID]
	for i, m := range ms {
		if m.UserID == userID {
			f.members[projectID] = append(ms[:i], ms[i+1:]...)
			return nil
		}
	}
	return ErrNotFound
}

func TestRemoveMember_HappyPath(t *testing.T) {
	s, _ := newSvc()
	tenant, owner := uuid.New(), uuid.New()
	p, _ := s.Create(context.Background(), tenant, owner, CreateInput{Name: "X"})
	editor := uuid.New()
	_, _ = s.AddMember(context.Background(), tenant, p.ID, editor, RoleEditor)

	if err := s.RemoveMember(context.Background(), tenant, p.ID, editor); err != nil {
		t.Fatalf("remove member: %v", err)
	}
	members, _ := s.ListMembers(context.Background(), tenant, p.ID)
	for _, m := range members {
		if m.UserID == editor {
			t.Fatal("editor still present after removal")
		}
	}
}

func TestRemoveMember_CrossTenant(t *testing.T) {
	s, _ := newSvc()
	tenantA, tenantB, user := uuid.New(), uuid.New(), uuid.New()
	p, _ := s.Create(context.Background(), tenantA, user, CreateInput{Name: "A"})
	err := s.RemoveMember(context.Background(), tenantB, p.ID, user)
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("cross-tenant remove must be ErrNotFound, got %v", err)
	}
}

func TestGetForUser_Member(t *testing.T) {
	s, _ := newSvc()
	tenant, owner := uuid.New(), uuid.New()
	p, _ := s.Create(context.Background(), tenant, owner, CreateInput{
		Name:         "Q4 Roadmap",
		SystemPrompt: "You are a roadmap assistant.",
	})

	got, err := s.GetForUser(context.Background(), tenant, p.ID, owner)
	if err != nil {
		t.Fatalf("owner should be a member: %v", err)
	}
	if got.SystemPrompt != "You are a roadmap assistant." {
		t.Fatalf("system prompt not returned: %q", got.SystemPrompt)
	}
}

func TestGetForUser_NonMember403(t *testing.T) {
	s, _ := newSvc()
	tenant, owner, stranger := uuid.New(), uuid.New(), uuid.New()
	p, _ := s.Create(context.Background(), tenant, owner, CreateInput{Name: "Private"})

	_, err := s.GetForUser(context.Background(), tenant, p.ID, stranger)
	if !errors.Is(err, ErrNotMember) {
		t.Fatalf("non-member must get ErrNotMember, got %v", err)
	}
}

func TestGetForUser_SystemPromptEnforced(t *testing.T) {
	s, _ := newSvc()
	tenant, owner := uuid.New(), uuid.New()
	prompt := "Answer only about finance."
	p, _ := s.Create(context.Background(), tenant, owner, CreateInput{
		Name:         "Finance Bot",
		SystemPrompt: prompt,
	})
	collaborator := uuid.New()
	_, _ = s.AddMember(context.Background(), tenant, p.ID, collaborator, RoleViewer)

	got, err := s.GetForUser(context.Background(), tenant, p.ID, collaborator)
	if err != nil {
		t.Fatalf("collaborator should be a member: %v", err)
	}
	if got.SystemPrompt != prompt {
		t.Fatalf("system prompt mismatch: want %q, got %q", prompt, got.SystemPrompt)
	}
}
