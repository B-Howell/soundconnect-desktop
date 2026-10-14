import { useEffect, useMemo, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  bindWindowCommands,
  noopWindowCommands,
  type WindowCommands,
} from "../components/frame/windowCommands";
import { useIsTauri } from "./useIsTauri";

export interface WindowControls extends WindowCommands {
  /** Drives the maximize/restore glyph; always false outside Tauri. */
  isMaximized: boolean;
}

/**
 * Minimize / maximize / close for the frameless window, plus the live maximized
 * state so the restore glyph is right after a drag-to-edge or double-click.
 * Outside Tauri every command is a no-op and `isMaximized` stays false.
 */
export function useWindowControls(): WindowControls {
  const inTauri = useIsTauri();
  const [isMaximized, setIsMaximized] = useState(false);

  const commands = useMemo(
    () => (inTauri ? bindWindowCommands(getCurrentWindow()) : noopWindowCommands),
    [inTauri],
  );

  useEffect(() => {
    if (!inTauri) {
      return;
    }
    const win = getCurrentWindow();
    let cancelled = false;
    const refresh = () => {
      win
        .isMaximized()
        .then((value) => {
          if (!cancelled) {
            setIsMaximized(value);
          }
        })
        .catch(console.error);
    };
    // Resize events arrive in bursts during a drag; ask once per frame.
    let frame = 0;
    const scheduleRefresh = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(refresh);
    };
    refresh();
    const unlisten = win.onResized(scheduleRefresh);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      unlisten.then((stop) => stop()).catch(console.error);
    };
  }, [inTauri]);

  return { ...commands, isMaximized };
}
