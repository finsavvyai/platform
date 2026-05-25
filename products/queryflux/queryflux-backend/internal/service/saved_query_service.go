package service

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/internal/port"
)

type SavedQueryService struct {
	repo port.SavedQueryRepository
}

func NewSavedQueryService(repo port.SavedQueryRepository) *SavedQueryService {
	return &SavedQueryService{repo: repo}
}

func (s *SavedQueryService) Create(
	ctx context.Context, userID string, req domain.CreateSavedQueryRequest,
) (*domain.SavedQuery, error) {
	now := time.Now()
	query := &domain.SavedQuery{
		ID:           uuid.New().String(),
		UserID:       userID,
		Name:         req.Name,
		SQL:          req.SQL,
		ConnectionID: req.ConnectionID,
		Description:  req.Description,
		Tags:         req.Tags,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := s.repo.Create(ctx, query); err != nil {
		return nil, err
	}
	return query, nil
}

func (s *SavedQueryService) ListByUser(
	ctx context.Context, userID string,
) ([]domain.SavedQuery, error) {
	return s.repo.FindByUserID(ctx, userID)
}

func (s *SavedQueryService) GetByID(
	ctx context.Context, userID, id string,
) (*domain.SavedQuery, error) {
	query, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if query.UserID != userID {
		return nil, ErrUnauthorized
	}
	return query, nil
}

func (s *SavedQueryService) Update(
	ctx context.Context, userID, id string, req domain.UpdateSavedQueryRequest,
) (*domain.SavedQuery, error) {
	query, err := s.GetByID(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	if req.Name != "" {
		query.Name = req.Name
	}
	if req.SQL != "" {
		query.SQL = req.SQL
	}
	if req.Description != "" {
		query.Description = req.Description
	}
	if req.Tags != nil {
		query.Tags = req.Tags
	}
	query.UpdatedAt = time.Now()
	if err := s.repo.Update(ctx, query); err != nil {
		return nil, err
	}
	return query, nil
}

func (s *SavedQueryService) Delete(ctx context.Context, userID, id string) error {
	query, err := s.GetByID(ctx, userID, id)
	if err != nil {
		return err
	}
	return s.repo.Delete(ctx, query.ID)
}
