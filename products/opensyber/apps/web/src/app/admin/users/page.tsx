import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { Users } from 'lucide-react';
import { UserTable } from '@/components/admin/UserTable';

export const metadata = { title: 'Admin — Users' };

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  isAdmin: boolean;
  isSuspended: boolean;
  createdAt: string;
}

interface UsersResponse {
  data: UserRow[];
  nextCursor: string | null;
  hasMore: boolean;
}

export default async function AdminUsersPage() {
  const token = await getApiToken();

  let users: UserRow[] = [];
  let nextCursor: string | null = null;
  let hasMore = false;

  try {
    if (token) {
      const data = await apiClient<UsersResponse>('/api/admin/users', { token });
      users = data.data;
      nextCursor = data.nextCursor;
      hasMore = data.hasMore;
    }
  } catch {
    // API not available
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Users</h1>
        <p className="mt-1 text-sm text-text-secondary">Manage platform users</p>
      </div>

      {users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
            <Users className="h-6 w-6 text-text-secondary" />
          </div>
          <h3 className="text-base font-semibold mb-1">No users found</h3>
          <p className="text-sm text-text-secondary">Users will appear here once they sign up.</p>
        </div>
      ) : (
        <UserTable initialUsers={users} initialNextCursor={nextCursor} initialHasMore={hasMore} />
      )}
    </div>
  );
}
