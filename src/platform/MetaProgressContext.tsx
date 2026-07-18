import { createContext, useContext, type ReactNode } from "react";
import { useMetaProgress, type UseMetaProgress } from "../hooks/useMetaProgress";

const MetaProgressContext = createContext<UseMetaProgress | null>(null);

/** Single meta store for the SPA shell + support simulator. */
export function MetaProgressProvider({ children }: { children: ReactNode }) {
  const value = useMetaProgress();
  return <MetaProgressContext.Provider value={value}>{children}</MetaProgressContext.Provider>;
}

export function useMetaProgressContext(): UseMetaProgress {
  const ctx = useContext(MetaProgressContext);
  if (!ctx) {
    throw new Error("useMetaProgressContext must be used within MetaProgressProvider");
  }
  return ctx;
}
