import { useStore } from "zustand";
import { useSettingsStore } from "../../state/settingsStore";
import { useUpdaterStore, type UpdatePhase, type UpdaterStore } from "../../state/updaterStore";
import { ListRow } from "../primitives/ListRow";
import { TextButton } from "../primitives/TextButton";
import { ToggleRow } from "../primitives/ToggleRow";

/** The line under "Check for updates" for each phase; "" before the first check. */
export function updateStatusText(phase: UpdatePhase, version: string | undefined, error: string | null): string {
  switch (phase) {
    case "idle":
      return "";
    case "checking":
      return "Checking…";
    case "upToDate":
      return "Up to date.";
    case "available":
      return `Version ${version ?? ""} is available.`;
    case "downloading":
      return "Downloading update…";
    case "installing":
      return "Installing update…";
    case "error":
      return error || "Update failed.";
  }
}

/**
 * Settings' update rows (inside a `GroupedList`): "Check for updates
 * automatically" (once a day at launch, on by default) and "Check for
 * updates" with the current state; a found update shows in the banner too.
 */
export function UpdateRows({ store = useUpdaterStore }: { store?: UpdaterStore }) {
  const auto = useSettingsStore((s) => s.checkForUpdates);
  const setAuto = useSettingsStore((s) => s.setCheckForUpdates);
  const phase = useStore(store, (s) => s.phase);
  const version = useStore(store, (s) => s.update?.version);
  const error = useStore(store, (s) => s.error);
  const busy = phase === "checking" || phase === "downloading" || phase === "installing";
  return (
    <>
      <ToggleRow
        title="Check for updates automatically"
        subtitle="Once a day at startup."
        checked={auto}
        onChange={setAuto}
      />
      <ListRow
        title="Check for updates"
        subtitle={updateStatusText(phase, version, error) || undefined}
        trailing={
          phase === "available" ? (
            <TextButton emphasized onPress={() => void store.getState().install()}>
              Install
            </TextButton>
          ) : (
            <TextButton disabled={busy} onPress={() => void store.getState().check()}>
              Check now
            </TextButton>
          )
        }
      />
    </>
  );
}
