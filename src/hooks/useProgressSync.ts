import { useEffect, useRef, useState } from "react";
import type { AuthUser } from "./useAuth";
import type { MetaState } from "../game/meta";

const SYNC_DEBOUNCE_MS = 3000;

/**
 * Cloud progress sync.
 * On login: pull remote and field-merge into local (via applyRemoteMeta → mergeMetaProgress).
 * On local change: debounce PUT. Server stores updated_at for observability; merge is client-side.
 */
export function useProgressSync(
  user: AuthUser | null,
  meta: MetaState,
  applyRemoteMeta: (remote: unknown) => void,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [readyUserId, setReadyUserId] = useState<string | null>(null);
  // Snapshot local meta at login for merge baseline without stale closure races.
  const metaAtLoginRef = useRef(meta);
  metaAtLoginRef.current = meta;

  // On login: pull remote progress and merge with local
  useEffect(() => {
    if (!user) {
      setReadyUserId(null);
      return;
    }

    let cancelled = false;
    setReadyUserId(null);
    fetch("/api/progress")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const remote = (data as { meta: MetaState | null }).meta;
        if (!remote) return;
        applyRemoteMeta(remote);
      })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        setReadyUserId(user.id);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, applyRemoteMeta]);

  // On meta change: debounce push to cloud
  useEffect(() => {
    if (!user) return;
    if (readyUserId !== user.id) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      fetch("/api/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(meta),
      }).catch(() => {});
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [user, meta, readyUserId]);
}
