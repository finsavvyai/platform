import { KeyRound } from 'lucide-react';
import EntitlementsClient from './EntitlementsClient';

export const metadata = { title: 'Identity & Entitlements' };

export default function EntitlementsPage(): React.ReactElement {
  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <KeyRound className="h-7 w-7 text-info" />
          <h1 className="text-4xl font-bold">Identity & Entitlements</h1>
        </div>
        <p className="text-sm text-neutral-400">
          Analyze permissions, detect over-privileged identities, and enforce least privilege
        </p>
      </div>
      <EntitlementsClient />
    </div>
  );
}
