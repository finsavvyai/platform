package postgres

import (
	"encoding/json"

	"github.com/queryflux/backend/internal/domain/sso"

	"github.com/jackc/pgx/v5"
)

// scanSSOProviders scans multiple SSO providers from rows
func scanSSOProviders(rows pgx.Rows) ([]*sso.SSOProvider, error) {
	var providers []*sso.SSOProvider
	for rows.Next() {
		var provider sso.SSOProvider
		var attributeMappingJSON []byte

		if err := rows.Scan(
			&provider.ID, &provider.Name, &provider.Type, &provider.EntityID,
			&provider.MetadataURL, &provider.MetadataXML, &provider.ClientID,
			&provider.ClientSecret, &provider.AuthURL, &provider.TokenURL,
			&provider.UserInfoURL, &provider.Scopes, &provider.Enabled,
			&provider.AutoProvision, &provider.DefaultRole, &provider.DefaultPlan,
			&attributeMappingJSON, &provider.CreatedAt, &provider.UpdatedAt,
		); err != nil {
			return nil, err
		}

		if len(attributeMappingJSON) > 0 {
			provider.AttributeMapping = string(attributeMappingJSON)
		}

		providers = append(providers, &provider)
	}

	return providers, nil
}

// scanSingleSSOProvider scans a single SSO provider from a row
func scanSingleSSOProvider(row pgx.Row) (*sso.SSOProvider, error) {
	var provider sso.SSOProvider
	var attributeMappingJSON []byte

	err := row.Scan(
		&provider.ID, &provider.Name, &provider.Type, &provider.EntityID,
		&provider.MetadataURL, &provider.MetadataXML, &provider.ClientID,
		&provider.ClientSecret, &provider.AuthURL, &provider.TokenURL,
		&provider.UserInfoURL, &provider.Scopes, &provider.Enabled,
		&provider.AutoProvision, &provider.DefaultRole, &provider.DefaultPlan,
		&attributeMappingJSON, &provider.CreatedAt, &provider.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	if len(attributeMappingJSON) > 0 {
		provider.AttributeMapping = string(attributeMappingJSON)
	}

	return &provider, nil
}

// scanSSOIdentities scans multiple SSO identities from rows
func scanSSOIdentities(rows pgx.Rows) ([]*sso.SSOIdentity, error) {
	var identities []*sso.SSOIdentity
	for rows.Next() {
		var identity sso.SSOIdentity
		var attributesJSON []byte

		if err := rows.Scan(
			&identity.ID, &identity.UserID, &identity.ProviderID,
			&identity.ExternalID, &identity.Email, &identity.Name,
			&identity.FirstName, &identity.LastName, &attributesJSON,
			&identity.LastAuthenticated, &identity.CreatedAt, &identity.UpdatedAt,
		); err != nil {
			return nil, err
		}

		if len(attributesJSON) > 0 {
			json.Unmarshal(attributesJSON, &identity.Attributes)
		}

		identities = append(identities, &identity)
	}

	return identities, nil
}

// scanSSOSessions scans multiple SSO sessions from rows
func scanSSOSessions(rows pgx.Rows) ([]*sso.SSOSession, error) {
	var sessions []*sso.SSOSession
	for rows.Next() {
		var session sso.SSOSession
		var metadataJSON []byte

		if err := rows.Scan(
			&session.ID, &session.IdentityID, &session.RequestID, &session.State,
			&session.Nonce, &session.RedirectURL, &metadataJSON,
			&session.ExpiresAt, &session.IsActive, &session.CreatedAt, &session.UpdatedAt,
		); err != nil {
			return nil, err
		}

		if len(metadataJSON) > 0 {
			json.Unmarshal(metadataJSON, &session.Metadata)
		}

		sessions = append(sessions, &session)
	}

	return sessions, nil
}

// scanEnterpriseSettings scans multiple enterprise settings from rows
func scanEnterpriseSettings(rows pgx.Rows) ([]*sso.EnterpriseSettings, error) {
	var settingsList []*sso.EnterpriseSettings
	for rows.Next() {
		var settings sso.EnterpriseSettings
		var roleMappingsJSON []byte

		if err := rows.Scan(
			&settings.ID, &settings.OrganizationID, &settings.ProviderID,
			&settings.RequireSSO, &settings.AllowLocalLogin,
			&settings.DomainWhitelist, &roleMappingsJSON,
			&settings.CreatedAt, &settings.UpdatedAt,
		); err != nil {
			return nil, err
		}

		if len(roleMappingsJSON) > 0 {
			settings.RoleMappings = string(roleMappingsJSON)
		}

		settingsList = append(settingsList, &settings)
	}

	return settingsList, nil
}
