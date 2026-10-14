import { ConnectionStatus } from "../components/shell/ConnectionStatus";
import { RememberedDeviceCard } from "../components/status/RememberedDeviceCard";
import { StatusSections } from "../components/status/StatusSections";
import { useConnectionView, useEngineConnected } from "../hooks/engine/useConnectionView";
import { useDeviceHeaderProps } from "../hooks/engine/useDeviceHeaderProps";
import { quickNoiseProps, useNoiseControlProps } from "../hooks/engine/useNoiseControlProps";
import { useNowPlayingProps } from "../hooks/engine/useNowPlayingProps";
import { useConnectAttempt } from "../hooks/setup/useConnectAttempt";
import { useOpenBluetoothSettings } from "../hooks/setup/useOpenBluetoothSettings";
import { useRememberedDevice } from "../hooks/setup/useRememberedDevice";
import { rememberedTitle, UNNAMED_HEADPHONES } from "../lib/devices/deviceTitle";

/**
 * Status: the connected device (device card, quick noise switch, now
 * playing) once the engine is Ready with a snapshot; else the remembered
 * headphones with Connect; else the connection state. Thin: the hooks map
 * engine state to props.
 */
export function StatusPage() {
  const connected = useEngineConnected();
  const view = useConnectionView();
  const device = useDeviceHeaderProps();
  const noise = useNoiseControlProps();
  const playback = useNowPlayingProps();
  const remembered = useRememberedDevice();
  const { connect } = useConnectAttempt();
  const openBluetoothSettings = useOpenBluetoothSettings();

  if (connected && device) {
    return (
      <StatusSections device={device} noise={noise ? quickNoiseProps(noise) : undefined} playback={playback ?? undefined} />
    );
  }
  if (remembered) {
    return (
      <RememberedDeviceCard
        name={rememberedTitle(remembered) ?? UNNAMED_HEADPHONES}
        modelName={remembered.modelName}
        view={view}
        onConnect={() => connect(remembered.address)}
        onOpenBluetoothSettings={openBluetoothSettings}
      />
    );
  }
  return <ConnectionStatus view={view} />;
}
