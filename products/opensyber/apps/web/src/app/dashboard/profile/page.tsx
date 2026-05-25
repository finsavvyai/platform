import Image from 'next/image';
import { auth } from '@/lib/auth';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { redirect } from 'next/navigation';
import { PLAN_CONFIGS } from '@opensyber/shared';
import { SignOutButton } from './SignOutButton';
import { ConnectedAccounts } from './ConnectedAccounts';

export const metadata = { title: 'Profile' };

interface UserData {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  createdAt: string;
  referralCode: string | null;
}

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect('/sign-in');

  const user = session.user as {
    id?: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
    provider?: string;
  };

  let apiUser: UserData | null = null;
  try {
    const token = await getApiToken();
    if (token) {
      const data = await apiClient<{ user: UserData }>('/api/user', { token });
      apiUser = data.user;
    }
  } catch { /* API not available */ }

  const plan = apiUser?.plan ?? 'free';
  const planConfig = PLAN_CONFIGS[plan as keyof typeof PLAN_CONFIGS];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-text-secondary mt-1">Your account information and connected services</p>
      </div>

      {/* Profile Card */}
      <div className="mb-8 rounded border border-border bg-panel/30 p-6">
        <div className="flex items-start gap-5">
          {user.image ? (
            <Image
              src={user.image}
              alt=""
              width={80}
              height={80}
              className="h-20 w-20 rounded-full object-cover ring-2 ring-border"
              referrerPolicy="no-referrer"
              unoptimized
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-border text-2xl font-bold text-text-secondary">
              {(user.name ?? 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <h2 className="text-xl font-semibold">{user.name ?? 'User'}</h2>
            <p className="text-sm text-text-secondary mt-1">{user.email}</p>
            {user.provider && (
              <p className="text-xs text-text-dim mt-2">
                Signed in via <span className="capitalize font-medium text-text-secondary">{user.provider.replace('microsoft-entra-id', 'Microsoft')}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Plan & Account Details */}
      <div className="mb-8 rounded border border-border bg-panel/30 p-6">
        <h3 className="text-lg font-semibold mb-4">Account Details</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-text-secondary">Plan</p>
            <p className="font-medium capitalize">{planConfig?.name ?? plan}</p>
          </div>
          <div>
            <p className="text-text-secondary">Member Since</p>
            <p className="font-medium">
              {apiUser?.createdAt
                ? new Date(apiUser.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-text-secondary">User ID</p>
            <p className="font-mono text-xs text-text-dim">{user.id ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-text-secondary">Referral Code</p>
            <p className="font-mono text-xs">{apiUser?.referralCode ?? 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Connected Accounts */}
      <ConnectedAccounts currentProvider={user.provider ?? null} email={user.email ?? ''} />

      {/* Sign Out */}
      <div className="mt-8 rounded border border-red-500/20 bg-red-500/5 p-6">
        <h3 className="text-lg font-semibold mb-2 text-red-400">Sign Out</h3>
        <p className="text-sm text-text-secondary mb-4">
          Sign out of your OpenSyber account on this device.
        </p>
        <SignOutButton />
      </div>
    </div>
  );
}
