import { useMemo } from "react";
import { GroupedList } from "../primitives/GroupedList";
import type { Option } from "../primitives/OptionList";
import { PickerRow } from "../primitives/PickerRow";
import { assignableKeyLabel } from "./assignableLabels";

export interface AssignableActionOption {
  /** `MDR_ASSIGNABLE_*` id. */
  action: number;
  label: string;
}

export interface AssignableControl {
  /** `MDR_ASSIGNABLE_ACTION_KEY_*` location; also the control's identity in `onChange`. */
  location: number;
  /** `MDR_ASSIGNABLE_ACTION_KEY_TYPE_*`; with `location` it names the row. */
  type: number;
  /** The assigned `MDR_ASSIGNABLE_*` id. */
  action: number;
  /** Name of the assigned function. */
  actionLabel: string;
  /** Functions this control accepts, when they differ per control (upstream asks per location). */
  actions?: readonly AssignableActionOption[];
}

export interface AssignableControlsCardProps {
  controls: readonly AssignableControl[];
  /** Functions every control accepts, unless a control lists its own. */
  actions: readonly AssignableActionOption[];
  onChange: (location: number, action: number) => void;
  disabled?: boolean;
}

function toOptions(actions: readonly AssignableActionOption[], control: AssignableControl): Option<number>[] {
  const options = actions.map((item) => ({ value: item.action, label: item.label }));
  // Keep the current assignment visible even if the device left it out of the list.
  if (!options.some((option) => option.value === control.action)) {
    options.unshift({ value: control.action, label: control.actionLabel });
  }
  return options;
}

interface ControlRowProps {
  control: AssignableControl;
  actions: readonly AssignableActionOption[];
  onChange: (location: number, action: number) => void;
  disabled?: boolean;
}

/** One control: its name over its current function, opening a sheet of the functions it accepts. */
function ControlRow({ control, actions, onChange, disabled }: ControlRowProps) {
  const options = useMemo(() => toOptions(control.actions ?? actions, control), [actions, control]);
  const name = assignableKeyLabel(control.location, control.type);
  return (
    <PickerRow
      title={name}
      sheetTitle={`${name} function`}
      options={options}
      value={control.action}
      onChange={(action) => onChange(control.location, action)}
      valuePlacement="subtitle"
      disabled={disabled}
    />
  );
}

/**
 * The headphones' customisable buttons and sensors, one row each with its
 * function under its name (function names are long, so not trailing).
 */
export function AssignableControlsCard({ controls, actions, onChange, disabled }: AssignableControlsCardProps) {
  return (
    <GroupedList aria-label="Assignable controls">
      {controls.map((control) => (
        <ControlRow
          key={control.location}
          control={control}
          actions={actions}
          onChange={onChange}
          disabled={disabled}
        />
      ))}
    </GroupedList>
  );
}
