import { QueryClient } from './QueryClient';

export const metadata = { title: 'Security Query' };

export default function SecurityQueryPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Security Query</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Ask questions about your security data in natural language
        </p>
      </div>
      <QueryClient />
    </div>
  );
}
