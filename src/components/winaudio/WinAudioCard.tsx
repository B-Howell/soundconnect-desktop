import type { SettingCard } from "../../lib/winaudio/rows";
import type { Change, SettingsPage } from "../../lib/winaudio/types";
import { LabelledSection } from "../page/LabelledSection";
import { GroupedList } from "../primitives/GroupedList";
import { WinAudioSettingRow } from "./WinAudioSettingRow";

export interface WinAudioCardProps {
  card: SettingCard;
  onChange: (change: Change) => void;
  onOpenSettings: (page: SettingsPage) => void;
  busy?: boolean;
}

/** One card of the Windows audio page: its section label and its rows. */
export function WinAudioCard({ card, onChange, onOpenSettings, busy }: WinAudioCardProps) {
  return (
    <LabelledSection title={card.title}>
      <GroupedList aria-label={card.title}>
        {card.rows.map((row) => (
          <WinAudioSettingRow
            key={row.id}
            row={row}
            onChange={onChange}
            onOpenSettings={onOpenSettings}
            busy={busy}
          />
        ))}
      </GroupedList>
    </LabelledSection>
  );
}
