import { useEffect, useState, useCallback } from "react";

export interface AuthUser {
  id: string;
  username: string;
  avatar_url: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    fetch("/api/me")
      .then(r => r.json())
      .then(data => setUser(((data as { user: AuthUser | null }).user) ?? null))
      .catch(() => setUser(null));
  }, []);

  const login = useCallback(() => {
    window.location.href = "/auth/login";
  }, []);

  const logout = useCallback(() => {
    window.location.href = "/auth/logout";
  }, []);

  return { user, loading: user === undefined, login, logout };
}
