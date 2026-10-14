import { useEffect, useId, type CSSProperties, type ReactNode } from "react";
import { useCommitOnRelease } from "../../hooks/useCommitOnRelease";
import "./Slider.css";

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Every value while the thumb moves; drive the on-screen state from this. */
  onChange: (value: number) => void;
  /** Once per gesture, on pointer release or key release; send device commands from this. */
  onCommit?: (value: number) => void;
  /**
   * True while the user drags or holds a key. The slider already shows the
   * user's value during a gesture; pages can also hold device echoes meanwhile.
   */
  onGestureChange?: (active: boolean) => void;
  /** Formats the visible value and `aria-valuetext`; defaults to the number. */
  formatValue?: (value: number) => string;
  /** Decorative glyph before the label, usually an `<Icon>` (for example the volume speaker). */
  leading?: ReactNode;
  disabled?: boolean;
  /**
   * `stacked` (default): label and value above a full-width track.
   * `inline`: label, track and value on one 44 px row, for a compact column
   * of related sliders such as equalizer bands.
   */
  layout?: "stacked" | "inline";
  /**
   * The value the filled part of the track grows from; defaults to `min`.
   * A signed control (an equalizer band, -10..10) passes 0, so +3 fills
   * right of the centre and -3 left of it.
   */
  origin?: number;
}

/**
 * A labelled native `<input type="range">` (keyboard, screen-reader and
 * pointer support come from the platform), restyled with a filled track and a
 * large white thumb. The label and the formatted value sit above the track.
 */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  onCommit,
  onGestureChange,
  formatValue = String,
  leading,
  disabled = false,
  layout = "stacked",
  origin = min,
}: SliderProps) {
  const inputId = useId();
  const gesture = useCommitOnRelease(value, { onCommit, onGestureChange });
  const shown = gesture.displayValue;
  const { onGestureEnd } = gesture;

  // A disabled input gets no pointerup, and Chromium does not reliably blur
  // an element that becomes disabled, so end any gesture here (for example
  // when a device echo disables the slider mid-drag).
  useEffect(() => {
    if (disabled) onGestureEnd();
  }, [disabled, onGestureEnd]);
  const fractionOf = (at: number) => (max > min ? (Math.min(Math.max(at, min), max) - min) / (max - min) : 0);
  const fillFrom = Math.min(fractionOf(origin), fractionOf(shown));
  const fillTo = Math.max(fractionOf(origin), fractionOf(shown));
  const formatted = formatValue(shown);

  const labelElement = (
    <label className="slider__label" htmlFor={inputId}>
      {leading ? <span className="slider__leading">{leading}</span> : null}
      {label}
    </label>
  );
  const output = (
    <output className="slider__value" htmlFor={inputId}>
      {formatted}
    </output>
  );
  const input = (
    <input
      id={inputId}
      className="slider__input"
      type="range"
      min={min}
      max={max}
      step={step}
      value={shown}
      disabled={disabled}
      aria-valuetext={formatted}
      style={{ "--slider-fill-from": `${fillFrom * 100}%`, "--slider-fill-to": `${fillTo * 100}%` } as CSSProperties}
      onChange={(event) => {
        const next = event.currentTarget.valueAsNumber;
        gesture.track(next);
        onChange(next);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        // Capture so the release reaches this input even when the pointer
        // has left it (the same reason usePointerDrag captures).
        try {
          event.currentTarget.setPointerCapture?.(event.pointerId);
        } catch {
          // NotFoundError if the pointer is already gone; blur still ends the gesture.
        }
        gesture.onPointerDown();
      }}
      onPointerUp={gesture.onPointerEnd}
      onPointerCancel={gesture.onPointerEnd}
      onBlur={gesture.onGestureEnd}
      onKeyDown={gesture.onKeyDown}
      onKeyUp={gesture.onKeyUp}
    />
  );

  if (layout === "inline") {
    return (
      <div className="slider slider--inline">
        {labelElement}
        {input}
        {output}
      </div>
    );
  }
  return (
    <div className="slider">
      <div className="slider__header">
        {labelElement}
        {output}
      </div>
      {input}
    </div>
  );
}
