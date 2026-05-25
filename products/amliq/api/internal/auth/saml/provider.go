package saml

import (
	"crypto"
	"crypto/x509"
	"errors"
	"net/http"
	"net/url"

	crewsaml "github.com/crewjam/saml"
)

// SAMLProvider wraps a crewjam/saml ServiceProvider for one tenant.
type SAMLProvider struct {
	sp *crewsaml.ServiceProvider
}

// NewSAMLProvider constructs a per-tenant ServiceProvider from
// loaded config + the SP private key + leaf cert. Use GenerateSPKeypair
// on first tenant setup; LoadSPKeypair on every login.
func NewSAMLProvider(cfg SAMLConfig, key crypto.Signer, spCert *x509.Certificate) (*SAMLProvider, error) {
	if cfg.SSOURL == "" {
		return nil, errors.New("saml: SAMLConfig.SSOURL required")
	}
	if cfg.SPEntityID == "" || cfg.ACSURL == "" {
		return nil, errors.New("saml: SPEntityID + ACSURL required")
	}
	if key == nil || spCert == nil {
		return nil, errors.New("saml: SP key + cert required")
	}
	idpMeta, err := buildIdPMetadata(cfg)
	if err != nil {
		return nil, err
	}
	acsURL, err := url.Parse(cfg.ACSURL)
	if err != nil {
		return nil, err
	}
	metaURL, err := url.Parse(cfg.MetadataURL)
	if err != nil {
		return nil, err
	}
	sp := &crewsaml.ServiceProvider{
		EntityID:    cfg.SPEntityID,
		Key:         key,
		Certificate: spCert,
		MetadataURL: *metaURL,
		AcsURL:      *acsURL,
		IDPMetadata: idpMeta,
	}
	return &SAMLProvider{sp: sp}, nil
}

// MakeAuthRequest returns the IdP redirect URL + the AuthnRequest ID.
// The caller is expected to persist the request ID in the session
// (cookie or server-side store) so ValidateResponse can match it.
func (p *SAMLProvider) MakeAuthRequest(relayState string) (redirectURL, requestID string, err error) {
	u, err := p.sp.MakeRedirectAuthenticationRequest(relayState)
	if err != nil {
		return "", "", err
	}
	authnReq, err := p.sp.MakeAuthenticationRequest(
		p.sp.GetSSOBindingLocation(crewsaml.HTTPRedirectBinding),
		crewsaml.HTTPRedirectBinding,
		crewsaml.HTTPPostBinding,
	)
	if err != nil {
		return "", "", err
	}
	return u.String(), authnReq.ID, nil
}

// ValidateResponse parses + validates the SAML assertion from the ACS
// HTTP request. possibleRequestIDs should be the IDs we issued via
// MakeAuthRequest in the same session — never an empty list (replay
// attack vector).
func (p *SAMLProvider) ValidateResponse(r *http.Request, possibleRequestIDs []string) (map[string]string, error) {
	assertion, err := p.sp.ParseResponse(r, possibleRequestIDs)
	if err != nil {
		return nil, err
	}
	attrs := make(map[string]string)
	attrs["nameID"] = assertion.Subject.NameID.Value
	for _, a := range assertion.AttributeStatements {
		for _, attr := range a.Attributes {
			if len(attr.Values) > 0 {
				attrs[attr.Name] = attr.Values[0].Value
			}
		}
	}
	return attrs, nil
}
