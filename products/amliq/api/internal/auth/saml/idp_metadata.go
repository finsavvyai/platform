package saml

import (
	"encoding/base64"
	"encoding/pem"
	"errors"

	crewsaml "github.com/crewjam/saml"
)

// buildIdPMetadata builds a minimal EntityDescriptor for the IdP from
// per-tenant fields. Avoids forcing admins to upload full IdP metadata
// XML on first setup — the four fields they paste from their IdP
// admin console (entity ID, SSO URL, x509 cert, location) are enough.
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
	if len(cfg.IdPCertPEM) == 0 {
		return desc, nil
	}
	block, _ := pem.Decode(cfg.IdPCertPEM)
	if block == nil {
		return nil, errors.New("saml: invalid IdP certificate PEM")
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
	return desc, nil
}
