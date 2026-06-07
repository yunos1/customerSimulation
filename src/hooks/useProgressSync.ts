import { useEffect, useRef, useState } from "react";
import type { AuthUser } from "./useAuth";
import type { MetaState } from "../game/meta";

const SYNC_DEBOUNCE_MS = 3000;

export function useProgressSync(
  user: AuthUser | null,
  meta: MetaState,
  applyRemoteMeta: (remote: unknown) => void,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [readyUserId, setReadyUserId] = useState<string | null>(null);

  // On login: pull remote progress (only if local has no runs yet)
  useEffect(() => {
    if (!user) {
      setReadyUserId(null);
      return;
    }

    let cancelled = false;
    setReadyUserId(null);
    fetch("/api/progress")
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const remote = (data as { meta: MetaState | null }).meta;
        if (!remote) return;
        const localRuns = meta.records?.totalRuns ?? 0;
        const remoteRuns = remote.records?.totalRuns ?? 0;
        if (remoteRuns > localRuns) {
          applyRemoteMeta(remote);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        setReadyUserId(user.id);
      });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
