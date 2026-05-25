package auth

import (
	"encoding/xml"
	"time"

	"gorm.io/gorm"
)

// SSOConfig represents SSO provider configuration stored in database
type SSOConfig struct {
	ID              uint              `json:"id" gorm:"primaryKey"`
	Provider        string            `json:"provider" gorm:"type:varchar(50);not null;uniqueIndex" validate:"required,max=50"`
	DisplayName     string            `json:"display_name" gorm:"type:varchar(100)" validate:"omitempty,max=100"`
	Type            string            `json:"type" gorm:"type:varchar(10);not null" validate:"required,oneof=saml oidc"`
	EntityID        string            `json:"entity_id" gorm:"type:varchar(255)" validate:"omitempty,max=255"`
	SSOUrl          string            `json:"sso_url" gorm:"type:varchar(500);not null" validate:"required,url,max=500"`
	Certificate     string            `json:"certificate" gorm:"type:text"`
	AttributeMap    map[string]string `json:"attribute_map" gorm:"serializer:json"`
	IsActive        bool              `json:"is_active" gorm:"default:true"`
	AutoCreateUsers bool              `json:"auto_create_users" gorm:"default:false"`
	CreatedAt       time.Time         `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time         `json:"updated_at" gorm:"autoUpdateTime"`
}

// TableName returns the table name for GORM
func (SSOConfig) TableName() string {
	return "sso_configs"
}

// SAML Response structures for parsing SAML assertions

// SAMLResponse represents the root SAML response
type SAMLResponse struct {
	XMLName      xml.Name      `xml:"urn:oasis:names:tc:SAML:2.0:protocol Response"`
	ID           string        `xml:"ID,attr"`
	Version      string        `xml:"Version,attr"`
	IssueInstant string        `xml:"IssueInstant,attr"`
	Destination  string        `xml:"Destination,attr"`
	Issuer       SAMLIssuer    `xml:"urn:oasis:names:tc:SAML:2.0:assertion Issuer"`
	Status       SAMLStatus    `xml:"urn:oasis:names:tc:SAML:2.0:protocol Status"`
	Assertion    SAMLAssertion `xml:"urn:oasis:names:tc:SAML:2.0:assertion Assertion"`
}

// SAMLIssuer represents the SAML issuer
type SAMLIssuer struct {
	XMLName xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:assertion Issuer"`
	Value   string   `xml:",chardata"`
}

// SAMLStatus represents the SAML status
type SAMLStatus struct {
	XMLName    xml.Name       `xml:"urn:oasis:names:tc:SAML:2.0:protocol Status"`
	StatusCode SAMLStatusCode `xml:"urn:oasis:names:tc:SAML:2.0:protocol StatusCode"`
}

// SAMLStatusCode represents the SAML status code
type SAMLStatusCode struct {
	XMLName xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:protocol StatusCode"`
	Value   string   `xml:"Value,attr"`
}

// SAMLAssertion represents the SAML assertion
type SAMLAssertion struct {
	XMLName            xml.Name               `xml:"urn:oasis:names:tc:SAML:2.0:assertion Assertion"`
	ID                 string                 `xml:"ID,attr"`
	Version            string                 `xml:"Version,attr"`
	IssueInstant       string                 `xml:"IssueInstant,attr"`
	Issuer             SAMLIssuer             `xml:"urn:oasis:names:tc:SAML:2.0:assertion Issuer"`
	Subject            SAMLSubject            `xml:"urn:oasis:names:tc:SAML:2.0:assertion Subject"`
	Conditions         SAMLConditions         `xml:"urn:oasis:names:tc:SAML:2.0:assertion Conditions"`
	AttributeStatement SAMLAttributeStatement `xml:"urn:oasis:names:tc:SAML:2.0:assertion AttributeStatement"`
}

// SAMLSubject represents the SAML subject
type SAMLSubject struct {
	XMLName xml.Name   `xml:"urn:oasis:names:tc:SAML:2.0:assertion Subject"`
	NameID  SAMLNameID `xml:"urn:oasis:names:tc:SAML:2.0:assertion NameID"`
}

// SAMLNameID represents the SAML name ID
type SAMLNameID struct {
	XMLName xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:assertion NameID"`
	Format  string   `xml:"Format,attr"`
	Value   string   `xml:",chardata"`
}

// SAMLConditions represents the SAML conditions
type SAMLConditions struct {
	XMLName      xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:assertion Conditions"`
	NotBefore    string   `xml:"NotBefore,attr"`
	NotOnOrAfter string   `xml:"NotOnOrAfter,attr"`
}

// SAMLAttributeStatement represents the SAML attribute statement
type SAMLAttributeStatement struct {
	XMLName    xml.Name        `xml:"urn:oasis:names:tc:SAML:2.0:assertion AttributeStatement"`
	Attributes []SAMLAttribute `xml:"urn:oasis:names:tc:SAML:2.0:assertion Attribute"`
}

// SAMLAttribute represents a SAML attribute
type SAMLAttribute struct {
	XMLName        xml.Name           `xml:"urn:oasis:names:tc:SAML:2.0:assertion Attribute"`
	Name           string             `xml:"Name,attr"`
	NameFormat     string             `xml:"NameFormat,attr"`
	AttributeValue SAMLAttributeValue `xml:"urn:oasis:names:tc:SAML:2.0:assertion AttributeValue"`
}

// SAMLAttributeValue represents a SAML attribute value
type SAMLAttributeValue struct {
	XMLName xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:assertion AttributeValue"`
	Type    string   `xml:"http://www.w3.org/2001/XMLSchema-instance type,attr"`
	Value   string   `xml:",chardata"`
}

// SSOSession represents an active SSO session
type SSOSession struct {
	ID         uint      `json:"id" gorm:"primaryKey"`
	SessionID  string    `json:"session_id" gorm:"type:varchar(255);not null;uniqueIndex" validate:"required,max=255"`
	UserID     string    `json:"user_id" gorm:"type:varchar(255);not null;index" validate:"required,max=255"`
	Provider   string    `json:"provider" gorm:"type:varchar(50);not null" validate:"required,max=50"`
	SSOSubject string    `json:"sso_subject" gorm:"type:varchar(255);not null" validate:"required,max=255"`
	CreatedAt  time.Time `json:"created_at" gorm:"autoCreateTime"`
	ExpiresAt  time.Time `json:"expires_at" gorm:"not null"`
	IsActive   bool      `json:"is_active" gorm:"default:true"`
	IPAddress  string    `json:"ip_address" gorm:"type:varchar(45)" validate:"omitempty,ip"`
	UserAgent  string    `json:"user_agent" gorm:"type:varchar(500)" validate:"omitempty,max=500"`
}

// TableName returns the table name for GORM
func (SSOSession) TableName() string {
	return "sso_sessions"
}

// IsExpired returns true if the SSO session has expired
func (s *SSOSession) IsExpired() bool {
	return time.Now().After(s.ExpiresAt)
}

// IsValid returns true if the SSO session is active and not expired
func (s *SSOSession) IsValid() bool {
	return s.IsActive && !s.IsExpired()
}

// Deactivate deactivates the SSO session
func (s *SSOSession) Deactivate() {
	s.IsActive = false
}

// BeforeCreate is a GORM hook that runs before creating a record
func (s *SSOSession) BeforeCreate(tx *gorm.DB) error {
	if s.SessionID == "" {
		s.SessionID = generateSessionID()
	}

	// Set default expiration to 8 hours if not set
	if s.ExpiresAt.IsZero() {
		s.ExpiresAt = time.Now().Add(8 * time.Hour)
	}

	return nil
}

// generateSessionID generates a unique session ID
func generateSessionID() string {
	return "sso_" + time.Now().Format("20060102150405")
}
