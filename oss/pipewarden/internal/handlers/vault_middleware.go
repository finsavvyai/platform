package handlers

import (
	"errors"
	"fmt"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

var errVaultRequired = errors.New("credential vault is required to persist provider credentials")

// EncryptCredentials encrypts sensitive fields in a ConnectionRecord before storage.
func (h *Handlers) EncryptCredentials(rec *storage.ConnectionRecord) error {
	if err := requireVaultForConnection(rec, h.vault != nil && h.vault.Enabled()); err != nil {
		return err
	}

	var err error
	if rec.Token != "" {
		rec.Token, err = h.vault.Encrypt(rec.Token)
		if err != nil {
			return fmt.Errorf("failed to encrypt token: %w", err)
		}
	}

	if rec.Username != "" {
		rec.Username, err = h.vault.Encrypt(rec.Username)
		if err != nil {
			return fmt.Errorf("failed to encrypt username: %w", err)
		}
	}

	if rec.AppPassword != "" {
		rec.AppPassword, err = h.vault.Encrypt(rec.AppPassword)
		if err != nil {
			return fmt.Errorf("failed to encrypt app_password: %w", err)
		}
	}

	return nil
}

// DecryptCredentials decrypts sensitive fields in a ConnectionRecord after retrieval.
func (h *Handlers) DecryptCredentials(rec *storage.ConnectionRecord) error {
	if err := requireVaultForConnection(rec, h.vault != nil && h.vault.Enabled()); err != nil {
		return err
	}

	var err error
	if rec.Token != "" {
		rec.Token, err = h.vault.Decrypt(rec.Token)
		if err != nil {
			return fmt.Errorf("failed to decrypt token: %w", err)
		}
	}

	if rec.Username != "" {
		rec.Username, err = h.vault.Decrypt(rec.Username)
		if err != nil {
			return fmt.Errorf("failed to decrypt username: %w", err)
		}
	}

	if rec.AppPassword != "" {
		rec.AppPassword, err = h.vault.Decrypt(rec.AppPassword)
		if err != nil {
			return fmt.Errorf("failed to decrypt app_password: %w", err)
		}
	}

	return nil
}

func connectionHasPersistedSecrets(rec *storage.ConnectionRecord) bool {
	if rec == nil {
		return false
	}
	return rec.Token != "" || rec.Username != "" || rec.AppPassword != ""
}

func requireVaultForConnection(rec *storage.ConnectionRecord, vaultEnabled bool) error {
	if connectionHasPersistedSecrets(rec) && !vaultEnabled {
		return fmt.Errorf("%w; set PIPEWARDEN_VAULT_KEY", errVaultRequired)
	}
	return nil
}

func vaultErrorStatus(err error) int {
	if errors.Is(err, errVaultRequired) {
		return 503
	}
	return 500
}
