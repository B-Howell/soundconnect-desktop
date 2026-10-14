import { NoiseControlSections } from "../components/noise/NoiseControlSections";
import { NotConnectedSection } from "../components/page/NotConnectedSection";
import { useAssignableControlsProps } from "../hooks/engine/useAssignableControlsProps";
import { useEngineConnected } from "../hooks/engine/useConnectionView";
import { useNoiseControlProps } from "../hooks/engine/useNoiseControlProps";

/** Noise control: Ambient Sound Control and the NC/AMB button's function, or a short "connect" note. */
export function NoiseControlPage() {
  const connected = useEngineConnected();
  const ambient = useNoiseControlProps();
  const button = useAssignableControlsProps();
  if (!connected) return <NotConnectedSection />;
  return <NoiseControlSections ambient={ambient ?? undefined} button={button ?? undefined} />;
}
