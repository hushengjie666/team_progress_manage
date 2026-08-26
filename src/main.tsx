import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { scheduleTauriLaunchFocus } from "./tauriLaunchFocus";
import "./styles.css";

const prepareTauriSmokeRuntime = async () => {
  if (import.meta.env.VITE_WDIO_TAURI === "1") {
    await import("@wdio/tauri-plugin");
  }
};

void prepareTauriSmokeRuntime().then(() => {
  scheduleTauriLaunchFocus();

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
