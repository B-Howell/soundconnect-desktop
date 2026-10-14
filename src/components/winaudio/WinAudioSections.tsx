import type { SettingCard } from "../../lib/winaudio/rows";
import type { Change, ChangeResult, SettingsPage } from "../../lib/winaudio/types";
import { CardGrid, CardStack } from "../page/CardGrid";
import { InfoNote } from "../primitives/InfoNote";
import { ApplyResultNote } from "./ApplyResultNote";
import { PlanPreviewSheet, type PlanPreviewSheetProps } from "./PlanPreviewSheet";
import { RestoreSheet } from "./RestoreSheet";
import { WinAudioCard } from "./WinAudioCard";
import { WinAudioSummary, type WinAudioSummaryProps } from "./WinAudioSummary";
import "./WinAudioSections.css";

export interface WinAudioSectionsProps {
  cards: SettingCard[];
  summary: WinAudioSummaryProps;
  preview: PlanPreviewSheetProps;
  restoreSheet: { open: boolean; onConfirm: () => void; onClose: () => void };
  results: ChangeResult[] | null;
  resultError: string | null;
  onDismissResults: () => void;
  /** A line above the cards, for example "not connected to Windows". */
  notice?: string | null;
  onChange: (change: Change) => void;
  onOpenSettings: (page: SettingsPage) => void;
  busy?: boolean;
}

/**
 * The Windows audio page's content: the summary card with the fixes across
 * the top, the last apply's outcome, then the four cards (Calls vs music and
 * Processing on the left, Format and volume and Connection on the right),
 * plus the preview and restore sheets. Presentational; `WindowsAudioPage`
 * feeds it.
 */
export function WinAudioSections({
  cards,
  summary,
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
            <WinAudioSummary {...summary} busy={busy} />
            <ApplyResultNote results={results} error={resultError} onDismiss={onDismissResults} />
            {notice ? <InfoNote>{notice}</InfoNote> : null}
          </div>
        </CardStack>
        <CardStack>
          {card("calls")}
          {card("processing")}
        </CardStack>
        <CardStack>
          {card("format")}
          {card("connection")}
        </CardStack>
      </CardGrid>
      <PlanPreviewSheet {...preview} />
      <RestoreSheet {...restoreSheet} />
    </>
  );
}
