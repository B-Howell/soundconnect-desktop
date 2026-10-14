import type { SettingCard } from "../../lib/winaudio/rows";
import type { Change, ChangeResult, SettingsPage } from "../../lib/winaudio/types";
import { CardGrid, CardStack } from "../page/CardGrid";
import { InfoNote } from "../primitives/InfoNote";
import { ApplyResultNote } from "./ApplyResultNote";
import { AudioModeSwitch, type AudioModeSwitchProps } from "./AudioModeSwitch";
import { PlanPreviewSheet, type PlanPreviewSheetProps } from "./PlanPreviewSheet";
import { RestoreSheet } from "./RestoreSheet";
import { WinAudioAdvanced, type WinAudioAdvancedProps } from "./WinAudioAdvanced";
import { WinAudioCard } from "./WinAudioCard";
import "./WinAudioSections.css";

export interface WinAudioSectionsProps {
  mode: Omit<AudioModeSwitchProps, "busy">;
  cards: SettingCard[];
  advanced: Omit<WinAudioAdvancedProps, "busy">;
  preview: PlanPreviewSheetProps;
  restoreSheet: { open: boolean; onConfirm: () => void; onClose: () => void };
  results: ChangeResult[] | null;
  resultError: string | null;
  onDismissResults: () => void;
  /** A line under the mode tiles, for example "not connected to Windows". */
  notice?: string | null;
  onChange: (change: Change) => void;
  onOpenSettings: (page: SettingsPage) => void;
  busy?: boolean;
}

/**
 * The Windows audio page's content: the two mode tiles across the top with
 * the summary line, the last apply's outcome, then Processing and Format and
 * volume on the left, Connection and the Advanced disclosure (Restore) on
 * the right, plus the preview and restore sheets. Presentational;
 * `WindowsAudioPage` feeds it.
 */
export function WinAudioSections({
  mode,
  cards,
  advanced,
  preview,
  restoreSheet,
  results,
  resultError,
  onDismissResults,
  notice,
  onChange,
  onOpenSettings,
  busy,
}: WinAudioSectionsProps) {
  const card = (id: SettingCard["id"]) => {
    const found = cards.find((c) => c.id === id);
    return found ? (
      <WinAudioCard card={found} onChange={onChange} onOpenSettings={onOpenSettings} busy={busy} />
    ) : null;
  };
  return (
    <>
      <CardGrid>
        <CardStack span="full">
          <div className="winaudio-sections__top">
            <AudioModeSwitch {...mode} busy={busy} />
            <ApplyResultNote results={results} error={resultError} onDismiss={onDismissResults} />
            {notice ? <InfoNote>{notice}</InfoNote> : null}
          </div>
        </CardStack>
        <CardStack>
          {card("processing")}
          {card("format")}
        </CardStack>
        <CardStack>
          {card("connection")}
          <WinAudioAdvanced {...advanced} busy={busy} />
        </CardStack>
      </CardGrid>
      <PlanPreviewSheet {...preview} />
      <RestoreSheet {...restoreSheet} />
    </>
  );
}
