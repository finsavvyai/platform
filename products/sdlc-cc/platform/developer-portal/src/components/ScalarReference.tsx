/**
 * ScalarReference - Interactive OpenAPI reference powered by Scalar.
 *
 * Renders the SDLC.ai OpenAPI specification using @scalar/api-reference-react
 * with the HeyGen-aligned deepSpace dark theme. Swagger UI has been retired
 * from the developer portal in favour of Scalar for clarity and HIG polish.
 */

import React from 'react';
import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';

export interface ScalarReferenceProps {
  /** URL of the OpenAPI (YAML or JSON) specification to render. */
  specUrl?: string;
  /** Optional inline OpenAPI content, takes precedence over specUrl. */
  specContent?: string;
  /** Show the Scalar sidebar with endpoint navigation. */
  showSidebar?: boolean;
}

const DEFAULT_SPEC_URL = '/openapi.yaml';

export const ScalarReference: React.FC<ScalarReferenceProps> = ({
  specUrl = DEFAULT_SPEC_URL,
  specContent,
  showSidebar = true,
}) => {
  const configuration = React.useMemo(
    () => ({
      spec: specContent ? { content: specContent } : { url: specUrl },
      theme: 'deepSpace' as const,
      darkMode: true,
      layout: 'modern' as const,
      showSidebar,
      hideDownloadButton: false,
      searchHotKey: 'k',
      metaData: {
        title: 'SDLC.ai API Reference',
        description: 'Secure Data Learning Platform API',
      },
      defaultHttpClient: {
        targetKey: 'shell',
        clientKey: 'curl',
      },
      customCss: `
        .scalar-api-reference {
          --scalar-background-1: #0a0a0f;
          --scalar-background-2: #12121a;
          --scalar-background-3: #1a1a2e;
          --scalar-color-1: #e2e8f0;
          --scalar-color-2: rgba(226, 232, 240, 0.85);
          --scalar-color-3: rgba(226, 232, 240, 0.6);
          --scalar-color-accent: #667eea;
          --scalar-border-color: rgba(102, 126, 234, 0.3);
        }
      `,
    }),
    [specUrl, specContent, showSidebar]
  );

  return (
    <div
      className="scalar-reference-host"
      style={{
        minHeight: '70vh',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid rgba(102, 126, 234, 0.3)',
      }}
    >
      <ApiReferenceReact configuration={configuration} />
    </div>
  );
};

export default ScalarReference;
