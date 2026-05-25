package onboarding

import (
	"context"
	"errors"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Sentinel errors for repository operations.
var (
	ErrSessionNotFound      = errors.New("onboarding session not found")
	ErrSessionAlreadyExists = errors.New("onboarding session already exists")
)

// OnboardingRepository defines persistence operations for onboarding sessions.
type OnboardingRepository interface {
	Create(ctx context.Context, session *OnboardingSession) error
	Get(ctx context.Context, sessionID string) (*OnboardingSession, error)
	Update(ctx context.Context, session *OnboardingSession) error
	List(ctx context.Context, limit int, offset int) ([]*OnboardingSession, int, error)
	GetAnalytics(ctx context.Context) (*OnboardingAnalytics, error)
	GetChecklist(ctx context.Context, sessionID string) (*IntegrationChecklist, error)
	SaveChecklist(ctx context.Context, checklist *IntegrationChecklist) error
}

// InMemoryOnboardingRepository is a thread-safe in-memory implementation.
type InMemoryOnboardingRepository struct {
	mu         sync.RWMutex
	sessions   map[string]*OnboardingSession
	checklists map[string]*IntegrationChecklist
}

// NewInMemoryOnboardingRepository creates a ready-to-use repository.
func NewInMemoryOnboardingRepository() *InMemoryOnboardingRepository {
	return &InMemoryOnboardingRepository{
		sessions:   make(map[string]*OnboardingSession),
		checklists: make(map[string]*IntegrationChecklist),
	}
}

// Create stores a new onboarding session. It assigns an ID if empty and
// sets CreatedAt/UpdatedAt timestamps.
func (r *InMemoryOnboardingRepository) Create(
	_ context.Context, session *OnboardingSession,
) error {
	if session.ID == "" {
		session.ID = uuid.New().String()
	}

	now := time.Now().UTC()
	session.CreatedAt = now
	session.UpdatedAt = now

	if err := ValidateOnboardingSession(*session); err != nil {
		return err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.sessions[session.ID]; exists {
		return ErrSessionAlreadyExists
	}

	stored := *session
	r.sessions[session.ID] = &stored
	return nil
}

// Get retrieves a session by ID. Returns ErrSessionNotFound when absent.
func (r *InMemoryOnboardingRepository) Get(
	_ context.Context, sessionID string,
) (*OnboardingSession, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	s, ok := r.sessions[sessionID]
	if !ok {
		return nil, ErrSessionNotFound
	}
	copied := *s
	return &copied, nil
}

// Update replaces an existing session. Returns ErrSessionNotFound if the
// session does not exist.
func (r *InMemoryOnboardingRepository) Update(
	_ context.Context, session *OnboardingSession,
) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.sessions[session.ID]; !exists {
		return ErrSessionNotFound
	}

	session.UpdatedAt = time.Now().UTC()
	stored := *session
	r.sessions[session.ID] = &stored
	return nil
}

// List returns a paginated slice of sessions sorted by CreatedAt descending,
// along with the total count.
func (r *InMemoryOnboardingRepository) List(
	_ context.Context, limit int, offset int,
) ([]*OnboardingSession, int, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	all := make([]*OnboardingSession, 0, len(r.sessions))
	for _, s := range r.sessions {
		copied := *s
		all = append(all, &copied)
	}

	sort.Slice(all, func(i, j int) bool {
		return all[i].CreatedAt.After(all[j].CreatedAt)
	})

	total := len(all)
	if offset >= total {
		return []*OnboardingSession{}, total, nil
	}
	end := offset + limit
	if end > total {
		end = total
	}
	return all[offset:end], total, nil
}

// GetChecklist retrieves the integration checklist for a session,
// creating a default one if none exists.
func (r *InMemoryOnboardingRepository) GetChecklist(
	_ context.Context, sessionID string,
) (*IntegrationChecklist, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.sessions[sessionID]; !ok {
		return nil, ErrSessionNotFound
	}

	if cl, ok := r.checklists[sessionID]; ok {
		copied := *cl
		copied.Items = append([]ChecklistItem{}, cl.Items...)
		return &copied, nil
	}

	cl := DefaultIntegrationChecklist(sessionID)
	r.checklists[sessionID] = &cl
	stored := cl
	stored.Items = append([]ChecklistItem{}, cl.Items...)
	return &stored, nil
}

// SaveChecklist persists the checklist for a session.
func (r *InMemoryOnboardingRepository) SaveChecklist(
	_ context.Context, checklist *IntegrationChecklist,
) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	stored := *checklist
	stored.Items = append([]ChecklistItem{}, checklist.Items...)
	r.checklists[checklist.SessionID] = &stored
	return nil
}
