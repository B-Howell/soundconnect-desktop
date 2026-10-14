import { Pill } from "../primitives/Pill";

export interface CodecBadgeProps {
  /** Codec name as the device reports it, for example "LDAC", "AAC" or "SBC". */
  codec: string;
}

/**
 * The active Bluetooth codec as a neutral chip. Its styling is the Pill's;
 * it adds only the spoken "Codec" prefix, so it has no CSS of its own.
 */
export function CodecBadge({ codec }: CodecBadgeProps) {
  return (
    <Pill>
      <span className="sr-only">Codec </span>
      {codec}
    </Pill>
  );
}
