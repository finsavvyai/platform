package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Email     string    `gorm:"uniqueIndex;not null" json:"email"`
	Password  string    `gorm:"not null" json:"-"`
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name"`
	Avatar    string    `json:"avatar"`
	IsActive  bool      `gorm:"default:true" json:"is_active"`
	Role      UserRole  `gorm:"default:user" json:"role"`

	// Timestamps
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	// Relationships
	Connectors []Connector `gorm:"foreignKey:UserID" json:"connectors,omitempty"`
	APIKeys    []APIKey    `gorm:"foreignKey:UserID" json:"api_keys,omitempty"`
}

type UserRole string

const (
	RoleAdmin    UserRole = "admin"
	RoleUser     UserRole = "user"
	RoleDeveloper UserRole = "developer"
)

func (u *User) TableName() string {
	return "users"
}

func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}