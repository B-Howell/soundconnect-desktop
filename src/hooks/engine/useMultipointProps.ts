import type { MultipointCardProps } from "../../components/devices/MultipointCard";
import { generalSettingSummary } from "../../components/system/generalSettingLabels";
import { MULTIPOINT_SUBJECT } from "../../lib/engine/applyCommand";
import { hasFeature } from "../../lib/engine/types";
import { useSnapshotProps, type SnapshotMapper } from "./useSnapshotProps";

/**
 * Connect to 2 devices simultaneously, from the general setting whose
 * subject is `MULTIPOINT_SETTING` (the XM4's `generalSettings[1]`, `true`,
 * summary `MULTIPOINT_SETTING_SUMMARY`); the switch sends
 * `setMultipoint {enabled}`. The System page leaves this setting out.
 */
export const toMultipointProps: SnapshotMapper<MultipointCardProps> = (snapshot, send) => {
  if (!hasFeature(snapshot, "GENERAL_SETTINGS")) return null;
  const setting = snapshot.generalSettings?.find((s) => s.subject === MULTIPOINT_SUBJECT && s.info.kind === "boolean");
  if (!setting) return null;
  return {
    enabled: setting.value,
    summary: generalSettingSummary(setting.summary),
    writable: setting.info.writable,
    onChange: (enabled) => send({ type: "setMultipoint", enabled }),
  };
};

/** The multipoint switch for the connected device, or null. */
export function useMultipointProps(): MultipointCardProps | null {
  return useSnapshotProps(toMultipointProps);
}
