'use client';

import { CodeBlock } from './CodeBlock';
import { useApiKey } from '@/lib/use-api';

export function ScriptTagBlock(): React.ReactElement {
  const key = useApiKey() ?? 'tf_your_api_key';
  const code = `<script src="https://tokenforge-api.opensyber.cloud/sdk.js" data-api-key="${key}"></script>`;
  return <CodeBlock code={code} language="html" />;
}
