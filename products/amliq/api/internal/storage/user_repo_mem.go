package storage

import (
	"context"
	"fmt"
	"sync"

	"github.com/aegis-aml/aegis/internal/domain"
)

type InMemoryUserRepo struct {
	mu    sync.RWMutex
	users map[string]domain.User
}

func NewInMemoryUserRepo() *InMemoryUserRepo {
	return &InMemoryUserRepo{users: make(map[string]domain.User)}
}

func (r *InMemoryUserRepo) Create(_ context.Context, user domain.User) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, u := range r.users {
		if u.Email == user.Email {
			return fmt.Errorf("user with email %s already exists", user.Email)
		}
	}
	r.users[user.ID] = user
	return nil
}

func (r *InMemoryUserRepo) GetByEmail(_ context.Context, email string) (*domain.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, u := range r.users {
		if u.Email == email {
			return &u, nil
		}
	}
	return nil, nil
}

func (r *InMemoryUserRepo) GetByID(_ context.Context, id string) (*domain.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	u, ok := r.users[id]
	if !ok {
		return nil, nil
	}
	return &u, nil
}

func (r *InMemoryUserRepo) GetByProvider(_ context.Context, provider, providerID string) (*domain.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, u := range r.users {
		if u.Provider == provider && u.ProviderID == providerID {
			return &u, nil
		}
	}
	return nil, nil
}

func (r *InMemoryUserRepo) ListAll(_ context.Context) ([]domain.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var users []domain.User
	for _, u := range r.users {
		users = append(users, u)
	}
	return users, nil
}
