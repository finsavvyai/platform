package adapter

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/queryflux/backend/internal/domain"
)

type SavedQueryRepositoryPostgres struct {
	pool *pgxpool.Pool
}

func NewSavedQueryRepositoryPostgres(pool *pgxpool.Pool) *SavedQueryRepositoryPostgres {
	return &SavedQueryRepositoryPostgres{pool: pool}
}

func (r *SavedQueryRepositoryPostgres) Create(ctx context.Context, q *domain.SavedQuery) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO saved_queries (id, user_id, name, sql_text, connection_id, description, tags, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		q.ID, q.UserID, q.Name, q.SQL, q.ConnectionID, q.Description, q.Tags, q.CreatedAt, q.UpdatedAt,
	)
	return err
}

func (r *SavedQueryRepositoryPostgres) FindByID(ctx context.Context, id string) (*domain.SavedQuery, error) {
	var q domain.SavedQuery
	err := r.pool.QueryRow(ctx,
		`SELECT id, user_id, name, sql_text, connection_id, description, tags, created_at, updated_at
		 FROM saved_queries WHERE id = $1`, id,
	).Scan(&q.ID, &q.UserID, &q.Name, &q.SQL, &q.ConnectionID, &q.Description, &q.Tags, &q.CreatedAt, &q.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &q, nil
}

func (r *SavedQueryRepositoryPostgres) FindByUserID(ctx context.Context, userID string) ([]domain.SavedQuery, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, user_id, name, sql_text, connection_id, description, tags, created_at, updated_at
		 FROM saved_queries WHERE user_id = $1 ORDER BY updated_at DESC`, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var queries []domain.SavedQuery
	for rows.Next() {
		var q domain.SavedQuery
		if err := rows.Scan(&q.ID, &q.UserID, &q.Name, &q.SQL, &q.ConnectionID,
			&q.Description, &q.Tags, &q.CreatedAt, &q.UpdatedAt); err != nil {
			return nil, err
		}
		queries = append(queries, q)
	}
	return queries, rows.Err()
}

func (r *SavedQueryRepositoryPostgres) Update(ctx context.Context, q *domain.SavedQuery) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE saved_queries SET name=$1, sql_text=$2, description=$3, tags=$4, updated_at=$5
		 WHERE id=$6`,
		q.Name, q.SQL, q.Description, q.Tags, q.UpdatedAt, q.ID,
	)
	return err
}

func (r *SavedQueryRepositoryPostgres) Delete(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM saved_queries WHERE id = $1`, id)
	return err
}
