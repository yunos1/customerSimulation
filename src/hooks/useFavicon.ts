const faviconBySimulator = {
  hub: "favicons/hub.ico",
  support: "favicons/customer-support.ico",
  interview: "favicons/interview-coach.ico",
  shiftRoster: "favicons/shift-roster.ico",
} as const;

type SimulatorId = keyof typeof faviconBySimulator;

export function setSimulatorFavicon(simulatorId: SimulatorId) {
  const href = `${import.meta.env.BASE_URL}${faviconBySimulator[simulatorId]}`;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');

  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.append(link);
  }

  link.type = "image/x-icon";
  link.href = href;
}
