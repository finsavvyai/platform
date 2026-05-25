/**
 * SAML SP metadata generator.
 *
 * Produces the XML metadata document IdPs (Okta, Entra) need to
 * configure the SP integration. Entity ID is the TokenForge API
 * base URL; ACS is the assertion consumer endpoint.
 */

const ENTITY_ID = 'https://tokenforge.opensyber.cloud';
const ACS_URL = 'https://tokenforge.opensyber.cloud/v1/saml/acs';
const SLO_URL = 'https://tokenforge.opensyber.cloud/v1/saml/slo';

export function generateSpMetadata(tenantId: string): string {
  const entityId = `${ENTITY_ID}/saml/sp/${tenantId}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="${entityId}">
  <md:SPSSODescriptor
    AuthnRequestsSigned="true"
    WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${ACS_URL}/${tenantId}"
      index="1"
      isDefault="true"/>
    <md:SingleLogoutService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${SLO_URL}/${tenantId}"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
}
