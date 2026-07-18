import { getManifestFavicon } from "../platform/registry";
import type { SimulatorId } from "../platform/types";

export function setSimulatorFavicon(simulatorId: string) {
  const relative = getManifestFavicon(simulatorId as SimulatorId);
  const href = `${import.meta.env.BASE_URL}${relative}`;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');

  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }

  link.type = "image/x-icon";
  link.href = href;
}
