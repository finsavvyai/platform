import { ShieldCheck } from 'lucide-react';
import AccessRequestsClient from './AccessRequestsClient';

export const metadata = { title: 'Access Requests' };

export default function AccessRequestsPage(): React.ReactElement {
  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <ShieldCheck className="h-7 w-7 text-info" />
          <h1 className="text-4xl font-bold">Zero Standing Privileges</h1>
        </div>
        <p className="text-sm text-neutral-400">
          Request, approve, and manage time-bound elevated access with full audit trail
        </p>
      </div>
      <AccessRequestsClient />
    </div>
  );
}
