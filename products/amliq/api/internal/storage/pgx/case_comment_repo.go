package pgx

import (
	"context"
	"database/sql"

	"github.com/aegis-aml/aegis/internal/domain"
)

type CaseCommentRepository struct {
	db *sql.DB
}

func NewCaseCommentRepository(db *sql.DB) *CaseCommentRepository {
	return &CaseCommentRepository{db: db}
}

func (r *CaseCommentRepository) Create(
	ctx context.Context, c domain.CaseComment,
) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO case_comments (id, case_id, user_id, content, created_at)
		VALUES ($1,$2,$3,$4,$5)`,
		c.ID, c.CaseID, c.AuthorID, c.Content, c.CreatedAt)
	return err
}

func (r *CaseCommentRepository) ListByCaseID(
	ctx context.Context, caseID string,
) ([]domain.CaseComment, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, case_id, user_id, content, created_at
		FROM case_comments WHERE case_id=$1
		ORDER BY created_at`, caseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var comments []domain.CaseComment
	for rows.Next() {
		var c domain.CaseComment
		if err := rows.Scan(&c.ID, &c.CaseID, &c.AuthorID,
			&c.Content, &c.CreatedAt); err != nil {
			return nil, err
		}
		comments = append(comments, c)
	}
	return comments, rows.Err()
}
