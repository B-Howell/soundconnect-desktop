import { DevicesSections } from "../components/devices/DevicesSections";
import { NotConnectedSection } from "../components/page/NotConnectedSection";
import { useEngineConnected } from "../hooks/engine/useConnectionView";
import { useMultipointProps } from "../hooks/engine/useMultipointProps";
import { usePairedDevicesProps } from "../hooks/engine/usePairedDevicesProps";
import { usePairingProps } from "../hooks/engine/usePairingProps";

/** Devices: multipoint, the paired devices and pairing a new one, or a short "connect" note. */
export function DevicesPage() {
  const connected = useEngineConnected();
  const multipoint = useMultipointProps();
  const paired = usePairedDevicesProps();
  const pairing = usePairingProps();
  if (!connected) return <NotConnectedSection />;
  return (
    <DevicesSections
      multipoint={multipoint ?? undefined}
      paired={paired ?? undefined}
      pairing={pairing ?? undefined}
    />
  );
}
