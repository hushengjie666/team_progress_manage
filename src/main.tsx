import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { TimerOverlayApp } from "./TimerOverlayApp";
import { DESKTOP_TIMER_WINDOW_LABEL } from "./desktopTimerOverlay";
import { scheduleTauriLaunchFocus } from "./tauriLaunchFocus";
import "./styles.css";

const prepareTauriSmokeRuntime = async () => {
  if (import.meta.env.VITE_WDIO_TAURI === "1") {
    await import("@wdio/tauri-plugin");
  }
};

const params = new URLSearchParams(window.location.search);
const timerOverlayWindow = params.get("window") === DESKTOP_TIMER_WINDOW_LABEL;
if (timerOverlayWindow) {
  document.documentElement.classList.add("timer-overlay-document");
  document.body.classList.add("timer-overlay-body");
}

void prepareTauriSmokeRuntime().then(() => {
  const Root = timerOverlayWindow ? TimerOverlayApp : App;
  if (Root === App) scheduleTauriLaunchFocus();

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>,
  );
});
