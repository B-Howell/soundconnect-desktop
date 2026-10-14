import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyTheme } from "./hooks/useApplyTheme";
import { useSettingsStore } from "./state/settingsStore";
import "./styles/global.css";

// The store hydrates synchronously from localStorage, so the saved theme is
// on <html> before React's first paint (no flash of the system scheme);
// `useApplyTheme` in App keeps it in step afterwards.
applyTheme(useSettingsStore.getState().theme);

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
