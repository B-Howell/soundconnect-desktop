import { NotConnectedSection } from "../components/page/NotConnectedSection";
import { SystemSections } from "../components/system/SystemSections";
import { useEngineConnected } from "../hooks/engine/useConnectionView";
import { useSystemProps } from "../hooks/engine/useSystemProps";

/** System: the connected headphones' own settings, or a short "connect" note. */
export function SystemPage() {
  const connected = useEngineConnected();
  const props = useSystemProps();
  return connected ? <SystemSections {...props} /> : <NotConnectedSection />;
}
