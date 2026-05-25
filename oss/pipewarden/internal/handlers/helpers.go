package handlers

import (
	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/integrations/azure"
	"github.com/finsavvyai/pipewarden/internal/integrations/bitbucket"
	"github.com/finsavvyai/pipewarden/internal/integrations/circleci"
	"github.com/finsavvyai/pipewarden/internal/integrations/demo"
	"github.com/finsavvyai/pipewarden/internal/integrations/github"
	"github.com/finsavvyai/pipewarden/internal/integrations/gitlab"
	"github.com/finsavvyai/pipewarden/internal/integrations/jenkins"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/mesh"
	"github.com/finsavvyai/pipewarden/internal/storage"
	"github.com/finsavvyai/pipewarden/internal/vault"
)

// buildProvider creates a Provider instance for the given platform. When
// the mesh is active, the provider's HTTP client is replaced with one
// that dials peers over the mesh; non-mesh hosts still resolve through
// Go's default DNS so this is safe for mixed-tenant deployments.
func buildProvider(platform, authMethod, token, username, appPassword, baseURL string, cfg *config.Config, logger *logging.Logger) integrations.Provider {
	p := buildProviderRaw(platform, authMethod, token, username, appPassword, baseURL, cfg, logger)
	if p != nil {
		mesh.Apply(p)
	}
	return p
}

func buildProviderRaw(platform, authMethod, token, username, appPassword, baseURL string, cfg *config.Config, logger *logging.Logger) integrations.Provider {
	if authMethod == "demo" {
		return demo.NewClient(integrations.Platform(platform), logger)
	}

	switch integrations.Platform(platform) {
	case integrations.PlatformGitHub:
		return github.NewClient(github.Config{Token: token, BaseURL: baseURL}, logger)
	case integrations.PlatformBitbucket:
		return bitbucket.NewClient(bitbucket.Config{Username: username, AppPassword: appPassword, BaseURL: baseURL}, logger)
	case integrations.PlatformGitLab:
		return gitlab.NewClient(gitlab.Config{Token: token, BaseURL: baseURL}, logger)
	case integrations.PlatformAzureDevOps:
		if cfg == nil || !cfg.Features.ExperimentalProviders {
			return nil
		}
		return azure.NewClient(azure.Config{Organization: username, Project: appPassword, Token: token}, logger)
	case integrations.PlatformJenkins:
		if cfg == nil || !cfg.Features.ExperimentalProviders {
			return nil
		}
		return jenkins.NewClient(jenkins.Config{BaseURL: baseURL, Username: username, APIToken: token}, logger)
	case integrations.PlatformCircleCI:
		if cfg == nil || !cfg.Features.ExperimentalProviders {
			return nil
		}
		return circleci.NewClient(circleci.Config{Token: token, BaseURL: baseURL}, logger)
	default:
		return nil
	}
}

// LoadConnectionsFromDB loads all connections from the database into the manager.
func LoadConnectionsFromDB(db *storage.DB, manager *integrations.Manager, v *vault.Vault, logger *logging.Logger, cfg *config.Config) {
	records, err := db.List()
	if err != nil {
		logger.Errorw("Failed to load connections from DB", "error", err)
		return
	}
	loaded := 0
	skipped := 0
	for _, rec := range records {
		if err := requireVaultForConnection(&rec, v != nil && v.Enabled()); err != nil {
			logger.Errorw("Skipping connection because vault is unavailable", "name", rec.Name, "platform", rec.Platform, "error", err)
			skipped++
			continue
		}

		// Decrypt credentials from storage
		recCopy := rec
		if v != nil {
			if err := decryptRecord(&recCopy, v); err != nil {
				logger.Errorw("Failed to decrypt connection", "name", rec.Name, "error", err)
				continue
			}
		}

		provider := buildProvider(recCopy.Platform, recCopy.AuthMethod, recCopy.Token, recCopy.Username, recCopy.AppPassword, recCopy.BaseURL, cfg, logger)
		if provider == nil {
			logger.Errorw("Unknown platform in DB, skipping", "name", rec.Name, "platform", rec.Platform)
			skipped++
			continue
		}
		if err := manager.Add(rec.Name, provider); err != nil {
			logger.Errorw("Failed to load connection", "name", rec.Name, "error", err)
			skipped++
			continue
		}
		loaded++
	}
	logger.Infow("Connections loaded from database", "loaded", loaded, "skipped", skipped)
}

// decryptRecord is a helper to decrypt credentials in a ConnectionRecord.
func decryptRecord(rec *storage.ConnectionRecord, v *vault.Vault) error {
	if !v.Enabled() {
		return nil
	}

	var err error
	if rec.Token != "" {
		rec.Token, err = v.Decrypt(rec.Token)
		if err != nil {
			return err
		}
	}

	if rec.Username != "" {
		rec.Username, err = v.Decrypt(rec.Username)
		if err != nil {
			return err
		}
	}

	if rec.AppPassword != "" {
		rec.AppPassword, err = v.Decrypt(rec.AppPassword)
		if err != nil {
			return err
		}
	}

	return nil
}

func inferAuthMethod(current, token, username, appPassword string) string {
	if current != "" {
		return current
	}
	switch {
	case appPassword != "" || username != "":
		return "basic"
	case token != "":
		return "token"
	default:
		return "token"
	}
}
