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

void prepareTauriSmokeRuntime().then(() => {
  const params = new URLSearchParams(window.location.search);
  const Root = params.get("window") === DESKTOP_TIMER_WINDOW_LABEL ? TimerOverlayApp : App;
  if (Root === App) scheduleTauriLaunchFocus();

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>,
  );
});
