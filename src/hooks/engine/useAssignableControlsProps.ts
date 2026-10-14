import type {
  AssignableControlsCardProps,
  AssignableControl as ControlRow,
} from "../../components/system/AssignableControlsCard";
import { assignableActionLabel } from "../../components/system/assignableLabels";
import { assignableActionIds, keyLocationIds, keyTypeIds } from "../../lib/engine/ids";
import { hasFeature, type AssignableControl } from "../../lib/engine/types";
import { useSnapshotProps, type SnapshotMapper } from "./useSnapshotProps";

/**
 * Upstream's client removes `MDR_ASSIGNABLE_GOOGLE_ASSISTANT` from every
 * location's list (Renderer doc, System page); the current assignment stays
 * listed (AssignableControlsCard keeps it).
 */
const HIDDEN_ACTIONS = new Set([assignableActionIds.toId("googleAssistant")]);

function controlRows(controls: AssignableControl[]): ControlRow[] {
  return controls.map((control) => {
    const action = assignableActionIds.toId(control.action);
    return {
      location: keyLocationIds.toId(control.location),
      type: keyTypeIds.toId(control.kind),
      action,
      actionLabel: assignableActionLabel(action),
      actions: control.options
        .map((option) => assignableActionIds.toId(option))
        .filter((id) => !HIDDEN_ACTIONS.has(id))
        .map((id) => ({ action: id, label: assignableActionLabel(id) })),
    };
  });
}

/** The whole list with one location's action replaced: `setAssignableControls` takes every control. */
export function withAssignedAction(controls: AssignableControl[], location: number, action: number): AssignableControl[] {
  return controls.map((control) =>
    keyLocationIds.toId(control.location) === location
      ? { ...control, action: assignableActionIds.toName(action) }
      : control,
  );
}

/**
 * The headphones' assignable buttons (`ASSIGNABLE_CONTROLS`; the XM4's
 * `custom` button, its CUSTOM button, set to `noiseControl` with options
 * `noiseControl`, `googleAssistant`, `amazonAlexa`): one row per control with
 * its own options, written as the whole list with `setAssignableControls`.
 */
export const toAssignableControlsProps: SnapshotMapper<AssignableControlsCardProps> = (snapshot, send) => {
  const controls = hasFeature(snapshot, "ASSIGNABLE_CONTROLS") ? (snapshot.assignableControls ?? []) : [];
  if (controls.length === 0) return null;
  return {
    controls: controlRows(controls),
    actions: [],
    onChange: (location, action) =>
      send({ type: "setAssignableControls", controls: withAssignedAction(controls, location, action) }),
  };
};

/** The button-function card for the connected device, or null. */
export function useAssignableControlsProps(): AssignableControlsCardProps | null {
  return useSnapshotProps(toAssignableControlsProps);
}
