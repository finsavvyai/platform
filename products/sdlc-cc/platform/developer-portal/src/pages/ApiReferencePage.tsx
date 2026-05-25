/**
 * ApiReferencePage - Interactive API reference powered by Scalar.
 *
 * This page renders the live OpenAPI specification for the SDLC.ai platform.
 * Scalar replaces the previous Swagger UI integration and matches the SDLC
 * HeyGen dark theme via deepSpace and custom CSS variables.
 */

import React from 'react';
import { ScalarReference } from '@/components/ScalarReference';

const DEFAULT_SPEC_URL =
  (import.meta as unknown as { env?: { VITE_OPENAPI_URL?: string } }).env
    ?.VITE_OPENAPI_URL ?? '/openapi.yaml';

export const ApiReferencePage: React.FC = () => {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl font-bold mb-2">API Reference</h1>
        <p className="text-lg text-muted-foreground">
          Complete, live API documentation generated from the SDLC.ai OpenAPI
          specification. Try any endpoint directly from this page.
        </p>
      </header>

      <ScalarReference specUrl={DEFAULT_SPEC_URL} />
    </div>
  );
};

export default ApiReferencePage;
