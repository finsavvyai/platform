package main

import (
	"errors"
	"flag"
	"strings"
)

// Args captures the command-line inputs. Validated by parseArgs so
// main.go doesn't sprinkle nil-checks across the happy path.
type Args struct {
	Tenant       string
	BaseURL      string
	IDPEntityID  string
	IDPSSOURL    string
	IDPCertPath  string
	PEMOnly      bool
}

// parseArgs reads flags and applies the validation that turns
// "missing input" into a single clear error message rather than a
// downstream panic.
func parseArgs() (*Args, error) {
	a := &Args{}
	flag.StringVar(&a.Tenant, "tenant", "",
		"Tenant ID (tnt_xxxxxxxxxxxx)")
	flag.StringVar(&a.BaseURL, "base-url", "",
		"Public scheme+host of the gateway (e.g. https://api.aegis.cc)")
	flag.StringVar(&a.IDPEntityID, "idp-entity-id", "",
		"IdP entity ID (from customer's IdP admin)")
	flag.StringVar(&a.IDPSSOURL, "idp-sso-url", "",
		"IdP SSO URL (HTTP-Redirect binding endpoint)")
	flag.StringVar(&a.IDPCertPath, "idp-cert-path", "",
		"Path to IdP X.509 cert (PEM)")
	flag.BoolVar(&a.PEMOnly, "pem-only", false,
		"Print key+cert PEMs only (skip SQL INSERT wrapper)")
	flag.Parse()

	if a.Tenant == "" {
		return nil, errors.New("--tenant is required")
	}
	if !strings.HasPrefix(a.Tenant, "tnt_") {
		return nil, errors.New("--tenant must start with tnt_")
	}
	if a.BaseURL == "" {
		return nil, errors.New("--base-url is required")
	}
	if a.IDPEntityID == "" || a.IDPSSOURL == "" {
		return nil, errors.New("--idp-entity-id and --idp-sso-url are required")
	}
	if a.IDPCertPath == "" {
		return nil, errors.New("--idp-cert-path is required")
	}
	a.BaseURL = strings.TrimRight(a.BaseURL, "/")
	return a, nil
}
