import { useEffect, useState } from "react";
import { getWinAudioApi } from "../../lib/winaudio";
import type { WinAudioApi } from "../../lib/winaudio/api";

/** The Windows audio api once it has loaded (the mock loads lazily); null until then. */
export function useWinAudioApi(): WinAudioApi | null {
  const [api, setApi] = useState<WinAudioApi | null>(null);
  useEffect(() => {
    let live = true;
    getWinAudioApi()
      .then((loaded) => {
        if (live) setApi(loaded);
      })
      .catch((error: unknown) => console.error("winaudio api failed to load", error));
    return () => {
      live = false;
    };
  }, []);
  return api;
}
