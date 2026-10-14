import { useCallback } from "react";
import { useEngineSend } from "../engine/useEngineCommand";

/** Opens the Windows Bluetooth settings page (`openBluetoothSettings`). */
export function useOpenBluetoothSettings(): () => void {
  const send = useEngineSend();
  return useCallback(() => send({ type: "openBluetoothSettings" }), [send]);
}
