package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
)

type customerRepository struct {
	db *pgxpool.Pool
}

// NewCustomerRepository creates a new postgres customer repository
func NewCustomerRepository(db *pgxpool.Pool) repositories.CustomerRepository {
	return &customerRepository{
		db: db,
	}
}

func (r *customerRepository) Create(ctx context.Context, c *entities.Customer) error {
	query := `
		INSERT INTO customers (
			id, user_id, email, name, country, zip, store_id,
			lemonsqueezy_id, lemonsqueezy_url, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
		)
	`
	_, err := r.db.Exec(ctx, query,
		c.ID, c.UserID, c.Email, c.Name, c.Country, c.Zip, c.StoreID,
		c.LemonsqueezyID, c.LemonsqueezyURL, c.CreatedAt, c.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create customer: %w", err)
	}
	return nil
}

func (r *customerRepository) GetByID(ctx context.Context, id string) (*entities.Customer, error) {
	query := `SELECT * FROM customers WHERE id = $1`
	return r.scanCustomer(r.db.QueryRow(ctx, query, id))
}

func (r *customerRepository) GetByUserID(ctx context.Context, userID string) (*entities.Customer, error) {
	query := `SELECT * FROM customers WHERE user_id = $1`
	return r.scanCustomer(r.db.QueryRow(ctx, query, userID))
}

func (r *customerRepository) GetByLemonSqueezyID(ctx context.Context, lemonSqueezyID string) (*entities.Customer, error) {
	query := `SELECT * FROM customers WHERE lemonsqueezy_id = $1`
	return r.scanCustomer(r.db.QueryRow(ctx, query, lemonSqueezyID))
}

func (r *customerRepository) Update(ctx context.Context, c *entities.Customer) error {
	query := `
		UPDATE customers SET
			email = $1, name = $2, country = $3, zip = $4,
			store_id = $5, lemonsqueezy_id = $6, lemonsqueezy_url = $7,
			updated_at = $8
		WHERE id = $9
	`
	_, err := r.db.Exec(ctx, query,
		c.Email, c.Name, c.Country, c.Zip, c.StoreID,
		c.LemonsqueezyID, c.LemonsqueezyURL, time.Now(), c.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update customer: %w", err)
	}
	return nil
}

func (r *customerRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM customers WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *customerRepository) GetByEmail(ctx context.Context, email string) (*entities.Customer, error) {
	query := `SELECT * FROM customers WHERE email = $1`
	return r.scanCustomer(r.db.QueryRow(ctx, query, email))
}

func (r *customerRepository) ListByStore(ctx context.Context, storeID string, limit, offset int) ([]*entities.Customer, error) {
	query := `SELECT * FROM customers WHERE store_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	rows, err := r.db.Query(ctx, query, storeID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var customers []*entities.Customer
	for rows.Next() {
		c, err := r.scanCustomer(rows)
		if err != nil {
			return nil, err
		}
		customers = append(customers, c)
	}
	return customers, nil
}

func (r *customerRepository) scanCustomer(row pgx.Row) (*entities.Customer, error) {
	var c entities.Customer
	err := row.Scan(
		&c.ID, &c.UserID, &c.Email, &c.Name, &c.Country, &c.Zip, &c.StoreID,
		&c.LemonsqueezyID, &c.LemonsqueezyURL, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("customer not found")
		}
		return nil, err
	}
	return &c, nil
}
