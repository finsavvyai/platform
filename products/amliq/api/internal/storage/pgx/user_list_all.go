package pgx

import (
	"context"

	"github.com/aegis-aml/aegis/internal/domain"
)

func (r *UserRepository) ListAll(ctx context.Context) ([]domain.User, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, tenant_id, email, password, role, provider,
		       provider_id, name, avatar_url, created_at
		FROM users ORDER BY created_at DESC LIMIT 200`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []domain.User
	for rows.Next() {
		var u domain.User
		if err := rows.Scan(&u.ID, &u.TenantID, &u.Email,
			&u.Password, &u.Role, &u.Provider, &u.ProviderID,
			&u.Name, &u.AvatarURL, &u.CreatedAt); err != nil {
			return nil, err
		}
		u.Password = "" // never expose
		users = append(users, u)
	}
	return users, rows.Err()
}
