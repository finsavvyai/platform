// Package sso provides SAML / OIDC SSO and MFA primitives.
// Day 24 of the production-ready roadmap.
package sso

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"math/big"
	"net/http"
	"net/url"
	"time"

	crewsaml "github.com/crewjam/saml"
)

// SAMLConfig is the per-tenant SAML IdP configuration persisted in idp_configs.
type SAMLConfig struct {
	// IdP values extracted from the IdP metadata XML the admin uploads.
	IdPEntityID  string
	SSOURL       string // IdP Single Sign-On HTTP-Redirect binding URL
	IdPCertPEM   []byte // IdP signing certificate (PEM)

	// SP values generated once per tenant and stored encrypted.
	SPEntityID  string // our SP entity ID (e.g. https://app.sdlc.cc/saml/<tenantID>)
	ACSURL      string // Assertion Consumer Service URL
	MetadataURL string // SP metadata URL
}

// SAMLProvider wraps a crewjam/saml ServiceProvider for a single tenant.
type SAMLProvider struct {
	sp *crewsaml.ServiceProvider
}

// NewSAMLProvider constructs a ServiceProvider from tenant SAML config and the
// SP private key + certificate. Use GenerateSPKeypair on first tenant setup.
func NewSAMLProvider(cfg SAMLConfig, key crypto.Signer, spCert *x509.Certificate) (*SAMLProvider, error) {
	if cfg.SSOURL == "" {
		return nil, errors.New("sso: SAMLConfig requires SSOURL")
	}
	if cfg.SPEntityID == "" || cfg.ACSURL == "" {
		return nil, errors.New("sso: SAMLConfig requires SPEntityID and ACSURL")
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

// MakeAuthRequest returns the IdP redirect URL and the opaque requestID that
// must be stored in the session and matched on the ACS callback.
func (p *SAMLProvider) MakeAuthRequest(relayState string) (redirectURL string, requestID string, err error) {
	u, err := p.sp.MakeRedirectAuthenticationRequest(relayState)
	if err != nil {
		return "", "", err
	}
	// The request ID is the _saml_request ID baked into the AuthnRequest; for
	// session tracking we use the opaque relay state the caller supplies.
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

// ValidateResponse parses and validates the SAML assertion from the ACS HTTP
// request. possibleRequestIDs should contain the ID stored in the session.
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

// GenerateSPKeypair creates a self-signed RSA-2048 keypair for use as the SP
// signing credential. Returns PEM-encoded key + cert suitable for database storage.
func GenerateSPKeypair(entityID string) (keyPEM, certPEM []byte, err error) {
	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, nil, err
	}
	serial, _ := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	tmpl := &x509.Certificate{
		SerialNumber: serial,
		Subject:      pkix.Name{CommonName: entityID},
		NotBefore:    time.Now().Add(-time.Minute),
		NotAfter:     time.Now().Add(10 * 365 * 24 * time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature,
	}
	derBytes, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &privKey.PublicKey, privKey)
	if err != nil {
		return nil, nil, err
	}
	keyPEM = pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(privKey)})
	certPEM = pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: derBytes})
	return keyPEM, certPEM, nil
}

// LoadSPKeypair decodes PEM-encoded key+cert into a tls.Certificate suitable
// for passing to NewSAMLProvider.
func LoadSPKeypair(keyPEM, certPEM []byte) (crypto.Signer, *x509.Certificate, error) {
	tlsCert, err := tls.X509KeyPair(certPEM, keyPEM)
	if err != nil {
		return nil, nil, err
	}
	leaf, err := x509.ParseCertificate(tlsCert.Certificate[0])
	if err != nil {
		return nil, nil, err
	}
	return tlsCert.PrivateKey.(crypto.Signer), leaf, nil
}

// buildIdPMetadata builds a minimal EntityDescriptor for the IdP from the
// per-tenant config values instead of requiring full metadata XML upload.
func buildIdPMetadata(cfg SAMLConfig) (*crewsaml.EntityDescriptor, error) {
	desc := &crewsaml.EntityDescriptor{
		EntityID: cfg.IdPEntityID,
		IDPSSODescriptors: []crewsaml.IDPSSODescriptor{
			{
				SSODescriptor: crewsaml.SSODescriptor{
					RoleDescriptor: crewsaml.RoleDescriptor{},
				},
				SingleSignOnServices: []crewsaml.Endpoint{
					{
						Binding:  crewsaml.HTTPRedirectBinding,
						Location: cfg.SSOURL,
					},
				},
			},
		},
	}

	if len(cfg.IdPCertPEM) > 0 {
		block, _ := pem.Decode(cfg.IdPCertPEM)
		if block == nil {
			return nil, errors.New("sso: invalid IdP certificate PEM")
		}
		b64 := base64.StdEncoding.EncodeToString(block.Bytes)
		desc.IDPSSODescriptors[0].KeyDescriptors = []crewsaml.KeyDescriptor{
			{
				Use: "signing",
				KeyInfo: crewsaml.KeyInfo{
					X509Data: crewsaml.X509Data{
						X509Certificates: []crewsaml.X509Certificate{
							{Data: b64},
						},
					},
				},
			},
		}
	}
	return desc, nil
}
