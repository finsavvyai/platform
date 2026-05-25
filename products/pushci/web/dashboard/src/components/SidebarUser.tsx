import { btnGestureSubtle } from '../styles/gestures';
import { getAvatarUrl } from '../utils/avatar';

interface User {
  login: string;
  avatar_url: string;
  name: string;
}

interface Props {
  user: User;
  onLogout: () => void;
}

export default function SidebarUser({ user, onLogout }: Props) {
  return (
    <>
      <div className="flex items-center gap-3">
        <img
          src={getAvatarUrl(user.avatar_url, user.login)}
          alt=""
          className="w-8 h-8 rounded-full"
        />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-zinc-200 text-sm truncate">{user.name || user.login}</div>
          <div className="text-xs text-zinc-500 truncate">@{user.login}</div>
        </div>
      </div>
      <button
        onClick={onLogout}
        className={`mt-3 text-xs text-zinc-500 hover:text-zinc-300 ${btnGestureSubtle}`}
      >
        Sign out
      </button>
    </>
  );
}
