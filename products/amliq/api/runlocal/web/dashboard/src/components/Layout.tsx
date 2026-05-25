import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

interface User {
  login: string;
  avatar_url: string;
  name: string;
}

interface Props {
  user: User;
  onLogout: () => void;
}

export default function Layout({ user, onLogout }: Props) {
  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar user={user} onLogout={onLogout} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
