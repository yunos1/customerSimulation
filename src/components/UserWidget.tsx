import { LogIn, LogOut, ShieldCheck } from "lucide-react";
import type { AuthUser } from "../hooks/useAuth";

interface Props {
  user: AuthUser | null;
  loading: boolean;
  onLogin: () => void;
  onLogout: () => void;
}

export function UserWidget({ user, loading, onLogin, onLogout }: Props) {
  if (loading) {
    return (
      <div className="user-widget user-widget--loading" aria-label="账号信息加载中">
        <span className="user-widget__skeleton user-widget__skeleton-avatar" />
        <span className="user-widget__skeleton user-widget__skeleton-line" />
      </div>
    );
  }

  if (!user) {
    return (
      <button className="user-widget user-widget--login" onClick={onLogin} title="Linux DO 登录">
        <span className="user-widget__login-icon">
          <LogIn size={16} />
        </span>
        <span className="user-widget__login-copy">
          <strong>登录</strong>
          <small>Linux DO</small>
        </span>
      </button>
    );
  }

  const initial = user.username.trim().charAt(0).toUpperCase() || "U";

  return (
    <div className="user-widget user-widget--user">
      <span className="user-widget__avatar-wrap">
        {user.avatar_url ? (
          <img className="user-widget__avatar" src={user.avatar_url} alt={user.username} />
        ) : (
          <span className="user-widget__initials">{initial}</span>
        )}
        <span className="user-widget__presence" aria-hidden="true" />
      </span>
      <span className="user-widget__identity">
        <span className="user-widget__name">{user.username}</span>
        <span className="user-widget__meta">
          <ShieldCheck size={12} aria-hidden="true" />
          Linux DO
        </span>
      </span>
      <button className="user-widget__logout" onClick={onLogout} title="退出登录">
        <LogOut size={15} />
      </button>
    </div>
  );
}
