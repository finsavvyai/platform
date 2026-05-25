package auth

import (
	"context"
	"fmt"
	"strings"

	"golang.org/x/oauth2"
)

func (s *SSOService) BuildOIDCLoginURL(ctx context.Context, provider, baseURL, state string) (string, error) {
	cfg, err := s.ensureOIDCConfig(ctx, provider, baseURL)
	if err != nil {
		return "", err
	}
	return cfg.AuthCodeURL(state), nil
}

func (s *SSOService) ExchangeOIDCCode(ctx context.Context, provider, code, baseURL string) (string, error) {
	cfg, err := s.ensureOIDCConfig(ctx, provider, baseURL)
	if err != nil {
		return "", err
	}
	token, err := cfg.Exchange(ctx, code)
	if err != nil {
		return "", fmt.Errorf("oidc code exchange failed: %w", err)
	}
	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok || strings.TrimSpace(rawIDToken) == "" {
		return "", fmt.Errorf("id_token missing in provider response")
	}
	return rawIDToken, nil
}

func (s *SSOService) ensureOIDCConfig(ctx context.Context, providerName, baseURL string) (*oauth2.Config, error) {
	providerConfig, err := s.getSSOConfig(ctx, providerName)
	if err != nil {
		return nil, err
	}
	if providerConfig.Type != "oidc" {
		return nil, fmt.Errorf("provider %s is not oidc", providerName)
	}
	if _, exists := s.oauth2Configs[providerName]; !exists {
		if err := s.initializeOIDCVerifier(ctx, providerConfig); err != nil {
			return nil, err
		}
	}
	cfg, exists := s.oauth2Configs[providerName]
	if !exists {
		return nil, fmt.Errorf("oidc oauth2 config missing for provider %s", providerName)
	}
	clone := *cfg
	clone.RedirectURL = buildOIDCRedirectURL(baseURL, providerName)
	return &clone, nil
}

func buildOIDCRedirectURL(baseURL, providerName string) string {
	clean := strings.TrimSuffix(strings.TrimSpace(baseURL), "/")
	return fmt.Sprintf("%s/auth/sso/%s/callback", clean, providerName)
}

