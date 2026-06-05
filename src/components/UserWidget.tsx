import { LogIn, LogOut } from "lucide-react";
import type { AuthUser } from "../hooks/useAuth";

interface Props {
  user: AuthUser | null;
  loading: boolean;
  onLogin: () => void;
  onLogout: () => void;
}

export function UserWidget({ user, loading, onLogin, onLogout }: Props) {
  if (loading) return null;

  if (!user) {
    return (
      <button className="user-widget user-widget--login" onClick={onLogin} title="Linux DO 登录">
        <LogIn size={15} />
        <span>登录</span>
      </button>
    );
  }

  return (
    <div className="user-widget user-widget--user">
      {user.avatar_url ? (
        <img className="user-widget__avatar" src={user.avatar_url} alt={user.username} />
      ) : (
        <span className="user-widget__initials">{user.username[0].toUpperCase()}</span>
      )}
      <span className="user-widget__name">{user.username}</span>
      <button className="user-widget__logout" onClick={onLogout} title="退出登录">
        <LogOut size={13} />
      </button>
    </div>
  );
}
