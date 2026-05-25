// Command saml-keygen generates a per-tenant SAML SP keypair and
// prints either an INSERT-ready SQL statement (default) or the raw
// PEM blocks (with --pem-only). The customer-side values they paste
// into their IdP — ACS URL, Entity ID — print to stderr so the
// stdout SQL is pipeable into psql without surrounding noise.
//
// Usage:
//
//	aegis-saml-keygen \
//	  --tenant tnt_abc123def456 \
//	  --base-url https://api.aegis.cc \
//	  --idp-entity-id https://customer.okta.com/exk... \
//	  --idp-sso-url   https://customer.okta.com/app/.../sso/saml \
//	  --idp-cert-path /path/to/idp.pem
//	  > insert.sql
package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	authsaml "github.com/aegis-aml/aegis/internal/auth/saml"
)

func main() {
	args, err := parseArgs()
	if err != nil {
		flag.Usage()
		log.Fatalf("saml-keygen: %v", err)
	}

	idpCert, err := os.ReadFile(args.IDPCertPath)
	if err != nil {
		log.Fatalf("saml-keygen: read IdP cert: %v", err)
	}

	spEntityID := fmt.Sprintf("%s/sso/%s/metadata", args.BaseURL, args.Tenant)
	spACS := fmt.Sprintf("%s/sso/%s/acs", args.BaseURL, args.Tenant)

	keyPEM, certPEM, err := authsaml.GenerateSPKeypair(spEntityID)
	if err != nil {
		log.Fatalf("saml-keygen: generate: %v", err)
	}

	if args.PEMOnly {
		fmt.Print(string(keyPEM))
		fmt.Print(string(certPEM))
		emitIdPInstructions(spEntityID, spACS)
		return
	}

	fmt.Println(buildSQL(args.Tenant, args.IDPEntityID, args.IDPSSOURL,
		string(idpCert), spEntityID, spACS,
		string(keyPEM), string(certPEM)))
	emitIdPInstructions(spEntityID, spACS)
}

// emitIdPInstructions writes the three values the customer's IdP
// admin needs to stderr, so the stdout stream stays SQL-only.
func emitIdPInstructions(entityID, acsURL string) {
	fmt.Fprintln(os.Stderr, "")
	fmt.Fprintln(os.Stderr, "Hand these to the customer's IdP admin:")
	fmt.Fprintln(os.Stderr, "  ACS URL:       "+acsURL)
	fmt.Fprintln(os.Stderr, "  Entity ID:     "+entityID)
	fmt.Fprintln(os.Stderr, "  Required attr: email")
	fmt.Fprintln(os.Stderr, "  Optional attr: role (defaults to 'viewer')")
}
