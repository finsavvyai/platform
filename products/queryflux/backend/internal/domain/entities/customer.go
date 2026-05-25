package entities

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Customer represents a Lemon Squeezy customer
type Customer struct {
	ID          string    `json:"id" db:"id"`
	UserID      string    `json:"user_id" db:"user_id"`
	Email       string    `json:"email" db:"email"`
	Name        string    `json:"name" db:"name"`
	Country     string    `json:"country" db:"country"`
	Zip         string    `json:"zip" db:"zip"`
	StoreID     string    `json:"store_id" db:"store_id"`
	LemonsqueezyID string `json:"lemonsqueezy_id" db:"lemonsqueezy_id"`
	LemonsqueezyURL string `json:"lemonsqueezy_url" db:"lemonsqueezy_url"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// NewCustomer creates a new customer
func NewCustomer(userID, email, name, storeID string) (*Customer, error) {
	if email == "" {
		return nil, fmt.Errorf("email is required")
	}

	if name == "" {
		return nil, fmt.Errorf("name is required")
	}

	now := time.Now()
	return &Customer{
		ID:        uuid.New().String(),
		UserID:    userID,
		Email:     email,
		Name:      name,
		StoreID:   storeID,
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

// UpdateLemonSqueezyInfo updates Lemon Squeezy customer information
func (c *Customer) UpdateLemonSqueezyInfo(lemonsqueezyID, lemonsqueezyURL string) {
	c.LemonsqueezyID = lemonsqueezyID
	c.LemonsqueezyURL = lemonsqueezyURL
	c.UpdatedAt = time.Now()
}

// UpdateAddress updates customer address information
func (c *Customer) UpdateAddress(country, zip string) {
	c.Country = country
	c.Zip = zip
	c.UpdatedAt = time.Now()
}

// UpdateProfile updates customer profile information
func (c *Customer) UpdateProfile(name string) error {
	if name == "" {
		return fmt.Errorf("name is required")
	}

	c.Name = name
	c.UpdatedAt = time.Now()
	return nil
}