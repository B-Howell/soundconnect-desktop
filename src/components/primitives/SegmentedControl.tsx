import { useId } from "react";
import { motion } from "framer-motion";
import { Icon, type IconName } from "../icons/Icon";
import { useSegmentedSelection } from "../../hooks/useSegmentedSelection";
import "./SegmentedControl.css";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

export interface SegmentedControlProps<T extends string> {
  /** Accessible name of the group (for example "Noise control"). */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  /**
   * Called for each new choice. `value` may lag (a device echo): choices are
   * compared with the last request, so quick successive choices all arrive.
   */
  onChange: (value: T) => void;
  /** Dims the control and takes it out of the tab order (for example while disconnected). */
  disabled?: boolean;
}

/**
 * iOS segmented control as a radio group. The selected segment carries a pill
 * that slides between segments through a shared framer-motion `layoutId`
 * (the app-wide `MotionConfig` supplies the spring and honours reduced motion).
 * Segments size to their content and share the leftover width, so a long
 * label next to short ones does not truncate.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: SegmentedControlProps<T>) {
  const pillId = useId();
  const selectedIndex = options.findIndex((option) => option.value === value);
  const { refFor, onKeyDown, select } = useSegmentedSelection(options.length, selectedIndex, (index) =>
    onChange(options[index].value),
  );

  return (
    <div
      className="segmented"
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onKeyDown={disabled ? undefined : onKeyDown}
    >
      {options.map((option, index) => {
        const selected = index === selectedIndex;
        return (
          <button
            key={option.value}
            ref={refFor(index)}
            type="button"
            role="radio"
            data-value={option.value}
            aria-checked={selected}
            tabIndex={selected || (selectedIndex === -1 && index === 0) ? 0 : -1}
            className="segmented__option"
            disabled={disabled}
            onClick={() => select(index)}
          >
            {selected ? <motion.span layoutId={pillId} className="segmented__pill" /> : null}
            <span className="segmented__label">
              {option.icon ? <Icon name={option.icon} /> : null}
              <span className="segmented__text">{option.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
