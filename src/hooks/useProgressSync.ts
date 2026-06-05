import { useEffect, useRef } from "react";
import type { AuthUser } from "./useAuth";
import type { MetaState } from "../game/meta";

const SYNC_DEBOUNCE_MS = 3000;

export function useProgressSync(user: AuthUser | null, meta: MetaState) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // On login: pull remote progress (only if local has no runs yet)
  useEffect(() => {
    if (!user) return;
    fetch("/api/progress")
      .then(r => r.json())
      .then(data => {
        const remote = (data as { meta: MetaState | null }).meta;
        if (!remote) return;
        const localRuns = meta.records?.totalRuns ?? 0;
        const remoteRuns = remote.records?.totalRuns ?? 0;
        if (remoteRuns > localRuns) {
          // Remote has more progress — write to localStorage so useMetaProgress picks it up
          localStorage.setItem("customer-sim:meta", JSON.stringify(remote));
          window.location.reload();
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // On meta change: debounce push to cloud
  useEffect(() => {
    if (!user) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      fetch("/api/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(meta),
      }).catch(() => {});
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [user, meta]);
}
