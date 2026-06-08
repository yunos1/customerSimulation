import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/base.css";
import "./styles/app.css";

if (import.meta.env.PROD) {
  const noop = () => {};
  (["log", "warn", "error", "info", "debug"] as const).forEach((m) => {
    console[m] = noop;
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "F12" || (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key))) {
      e.preventDefault();
    }
  });
  document.addEventListener("contextmenu", (e) => e.preventDefault());
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
