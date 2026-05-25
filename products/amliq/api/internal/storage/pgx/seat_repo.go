package pgx

import (
	"context"
	"database/sql"

	"github.com/aegis-aml/aegis/internal/domain"
)

type SeatRepository struct {
	db *sql.DB
}

func NewSeatRepository(db *sql.DB) *SeatRepository {
	return &SeatRepository{db: db}
}

func (r *SeatRepository) Create(ctx context.Context, seat domain.Seat) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO seats (id, tenant_id, user_id, user_email, role, activated_at)
		VALUES ($1,$2,$3,$4,$5,$6)`,
		seat.ID, seat.TenantID, seat.UserID,
		seat.Email, seat.Role, seat.ActivatedAt)
	return err
}

func (r *SeatRepository) ListByTenant(
	ctx context.Context, tenantID string,
) ([]domain.Seat, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, tenant_id, user_id, user_email, role,
		       activated_at, deactivated_at
		FROM seats WHERE tenant_id=$1 AND deactivated_at IS NULL
		ORDER BY activated_at`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanSeats(rows)
}

func (r *SeatRepository) UpdateRole(
	ctx context.Context, seatID string, role domain.Role,
) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE seats SET role=$1 WHERE id=$2`,
		string(role), seatID)
	return err
}

func (r *SeatRepository) Deactivate(ctx context.Context, seatID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE seats SET deactivated_at=NOW() WHERE id=$1 AND deactivated_at IS NULL`,
		seatID)
	return err
}

func (r *SeatRepository) CountByTenant(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM seats WHERE tenant_id=$1 AND deactivated_at IS NULL`,
		tenantID).Scan(&count)
	return count, err
}

func scanSeats(rows *sql.Rows) ([]domain.Seat, error) {
	var seats []domain.Seat
	for rows.Next() {
		var s domain.Seat
		if err := rows.Scan(&s.ID, &s.TenantID, &s.UserID,
			&s.Email, &s.Role, &s.ActivatedAt, &s.DeactivatedAt,
		); err != nil {
			return nil, err
		}
		seats = append(seats, s)
	}
	return seats, rows.Err()
}
