package service

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/google/uuid"
	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/internal/port"
)

var (
	ErrConnectionNotFound = errors.New("connection not found")
	ErrUnauthorized       = errors.New("unauthorized access to connection")
)

type ConnectionService struct {
	repo      port.ConnectionRepository
	encKey    []byte
}

func NewConnectionService(repo port.ConnectionRepository, encryptionKey string) *ConnectionService {
	key := []byte(encryptionKey)
	if len(key) < 32 {
		padded := make([]byte, 32)
		copy(padded, key)
		key = padded
	}

	return &ConnectionService{repo: repo, encKey: key[:32]}
}

func (s *ConnectionService) Create(ctx context.Context, userID string, req domain.CreateConnectionRequest) (*domain.Connection, error) {
	encrypted, err := s.encryptPassword(req.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt password: %w", err)
	}

	sslMode := "disable"
	if req.SSL {
		sslMode = "require"
	}

	conn := &domain.Connection{
		ID:                uuid.New().String(),
		UserID:            userID,
		Name:              req.Name,
		Type:              req.Type,
		Host:              req.Host,
		Port:              req.Port,
		Database:          req.Database,
		Username:          req.Username,
		EncryptedPassword: encrypted,
		SSLMode:           sslMode,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	if err := s.repo.Create(ctx, conn); err != nil {
		return nil, err
	}

	return conn, nil
}

func (s *ConnectionService) GetByID(ctx context.Context, userID, connID string) (*domain.Connection, error) {
	conn, err := s.repo.FindByID(ctx, connID)
	if err != nil {
		return nil, ErrConnectionNotFound
	}

	if conn.UserID != userID {
		return nil, ErrUnauthorized
	}

	return conn, nil
}

func (s *ConnectionService) ListByUser(ctx context.Context, userID string) ([]domain.Connection, error) {
	return s.repo.FindByUserID(ctx, userID)
}

func (s *ConnectionService) Update(ctx context.Context, userID, connID string, req domain.UpdateConnectionRequest) (*domain.Connection, error) {
	conn, err := s.GetByID(ctx, userID, connID)
	if err != nil {
		return nil, err
	}

	if req.Name != "" {
		conn.Name = req.Name
	}
	if req.Host != "" {
		conn.Host = req.Host
	}
	if req.Port != 0 {
		conn.Port = req.Port
	}
	if req.Database != "" {
		conn.Database = req.Database
	}
	if req.Username != "" {
		conn.Username = req.Username
	}
	if req.Password != "" {
		encrypted, err := s.encryptPassword(req.Password)
		if err != nil {
			return nil, fmt.Errorf("failed to encrypt password: %w", err)
		}
		conn.EncryptedPassword = encrypted
	}
	if req.SSL != nil {
		if *req.SSL {
			conn.SSLMode = "require"
		} else {
			conn.SSLMode = "disable"
		}
	}

	conn.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, conn); err != nil {
		return nil, err
	}

	return conn, nil
}

func (s *ConnectionService) Delete(ctx context.Context, userID, connID string) error {
	conn, err := s.GetByID(ctx, userID, connID)
	if err != nil {
		return err
	}

	return s.repo.Delete(ctx, conn.ID)
}

func (s *ConnectionService) DecryptPassword(encrypted string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(encrypted)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(s.encKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

func (s *ConnectionService) encryptPassword(password string) (string, error) {
	block, err := aes.NewCipher(s.encKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(password), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}
