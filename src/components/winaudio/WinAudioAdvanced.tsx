import { useDisclosure } from "../../hooks/useDisclosure";
import { Icon } from "../icons/Icon";
import { GroupedList } from "../primitives/GroupedList";
import { ListRow } from "../primitives/ListRow";
import "./WinAudioAdvanced.css";

export interface WinAudioAdvancedProps {
  /** Present when a restore point exists. */
  onRestore?: () => void;
  onForgetRestorePoint?: () => void;
  onOpenSoundSettings: () => void;
  busy?: boolean;
}

/**
 * The page's small "Advanced" disclosure, closed by default: Restore (the
 * state before SoundConnect's first change), Forget restore point, and Open
 * Windows Sound settings. Without a restore point the first row only says
 * so (plain text, not a dimmed button).
 */
export function WinAudioAdvanced({ onRestore, onForgetRestorePoint, onOpenSoundSettings, busy = false }: WinAudioAdvancedProps) {
  const { buttonProps, panelProps } = useDisclosure();
  return (
    <section className="winaudio-advanced">
      <button type="button" className="winaudio-advanced__toggle" {...buttonProps}>
        <Icon name="chevron-right" className="winaudio-advanced__chevron" />
        Advanced
      </button>
      <div className="winaudio-advanced__panel" {...panelProps}>
        <GroupedList aria-label="Advanced">
          <ListRow
            title="Restore previous settings"
            subtitle={
              onRestore
                ? "Settings from before the first change."
                : "No restore point yet."
            }
            disclosure={!!onRestore}
            disabled={busy}
            onPress={onRestore}
          />
          {onForgetRestorePoint ? (
            <ListRow
              title="Forget restore point"
              subtitle="Keeps the current settings."
              disabled={busy}
              onPress={onForgetRestorePoint}
            />
          ) : null}
          <ListRow
            title="Open Windows Sound settings"
            disclosure
            onPress={onOpenSoundSettings}
          />
        </GroupedList>
      </div>
    </section>
  );
}
