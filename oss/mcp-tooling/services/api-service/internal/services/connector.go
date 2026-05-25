package services

import (
	"context"

	"gorm.io/gorm"

	"github.com/mcpoverflow/api-service/internal/models"
)

// ConnectorService defines the interface for connector management
type ConnectorService interface {
	CreateConnector(ctx context.Context, connector *models.Connector) error
	GetConnector(ctx context.Context, id string) (*models.Connector, error)
	ListConnectors(ctx context.Context, userID string, limit, offset int) ([]*models.Connector, int64, error)
	UpdateConnector(ctx context.Context, connector *models.Connector) error
	DeleteConnector(ctx context.Context, id string) error
}

type connectorService struct {
	db *gorm.DB
}

// NewConnectorService creates a new instance of ConnectorService
func NewConnectorService(db *gorm.DB) ConnectorService {
	return &connectorService{db: db}
}

func (s *connectorService) CreateConnector(ctx context.Context, connector *models.Connector) error {
	return s.db.WithContext(ctx).Create(connector).Error
}

func (s *connectorService) GetConnector(ctx context.Context, id string) (*models.Connector, error) {
	var connector models.Connector
	if err := s.db.WithContext(ctx).Preload("Agents").Where("id = ?", id).First(&connector).Error; err != nil {
		return nil, err
	}
	return &connector, nil
}

func (s *connectorService) ListConnectors(ctx context.Context, userID string, limit, offset int) ([]*models.Connector, int64, error) {
	var connectors []*models.Connector
	var total int64

	query := s.db.WithContext(ctx).Model(&models.Connector{}).Where("user_id = ?", userID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := query.Preload("Agents").Offset(offset).Limit(limit).Order("created_at DESC").Find(&connectors).Error; err != nil {
		return nil, 0, err
	}

	return connectors, total, nil
}

func (s *connectorService) UpdateConnector(ctx context.Context, connector *models.Connector) error {
	return s.db.WithContext(ctx).Save(connector).Error
}

func (s *connectorService) DeleteConnector(ctx context.Context, id string) error {
	return s.db.WithContext(ctx).Delete(&models.Connector{}, "id = ?", id).Error
}
