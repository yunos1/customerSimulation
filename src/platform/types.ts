import type { ComponentType } from "react";
import type { AuthUser } from "../hooks/useAuth";
import type { LucideIcon } from "lucide-react";

/** Canonical simulator ids used for routing, favicon, and registry keys. */
export type SimulatorId =
  | "hub"
  | "support"
  | "interview"
  | "shiftRoster"
  | "clinicTriage"
  | "slacker";

export type HubTone = "teal" | "red" | "amber" | "cyan" | "violet";

/**
 * Declarative metadata for a simulator module.
 * Hub cards, favicons, and ordering are driven from this — not hard-coded switches.
 */
export type SimulatorManifest = {
  id: Exclude<SimulatorId, "hub">;
  /** Hub card title */
  title: string;
  /** Short category label above the title */
  category: string;
  description: string;
  status: "live" | "soon";
  tone: HubTone;
  /** Path relative to site base, e.g. favicons/customer-support.ico */
  favicon: string;
  /** Sort order in Module Bay (lower first) */
  hubOrder: number;
  /** Whether this card appears in the Module Bay grid */
  showInLibrary: boolean;
  /** Hero primary/secondary CTA flags */
  hubPrimary?: boolean;
  requiresAuth?: boolean;
  /** Static meta chips on the hub card (support can override via getHubMeta) */
  meta: string[];
  icon: LucideIcon;
};

/** Props every simulator entry receives from the platform shell. */
export type SimulatorHostProps = {
  user: AuthUser | null;
  authLoading: boolean;
  onBackToHub: () => void;
  onLogin: () => void;
  onLogout: () => void;
};

export type SimulatorModule = {
  manifest: SimulatorManifest;
  /** Eager component (legacy); prefer registry load() for code-splitting. */
  Component?: ComponentType<SimulatorHostProps>;
  /** Dynamic import entry for code-split simulators. */
  load?: () => Promise<ComponentType<SimulatorHostProps>>;
};
