const faviconBySimulator: Record<string, string> = {
  hub: "favicons/hub.ico",
  support: "favicons/customer-support.ico",
  interview: "favicons/interview-coach.ico",
  shiftRoster: "favicons/shift-roster.ico",
  clinicTriage: "favicons/clinic-triage.ico",
  slacker: "favicons/hub.ico",
};

export function setSimulatorFavicon(simulatorId: string) {
  const href = `${import.meta.env.BASE_URL}${faviconBySimulator[simulatorId]}`;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');

  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }

  link.type = "image/x-icon";
  link.href = href;
}
