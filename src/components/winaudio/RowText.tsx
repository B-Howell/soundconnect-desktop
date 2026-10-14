import type { SettingRow } from "../../lib/winaudio/rows";
import { AdminShield } from "./AdminShield";
import { RecommendedNote } from "./RecommendedNote";
import "./RowText.css";

/** A row's title (with the admin shield) for `ListRow.title`. */
export function RowTitle({ row }: { row: Pick<SettingRow, "title" | "admin"> }) {
  return (
    <span className="winaudio-row__title">
      {row.title}
      {row.admin ? <AdminShield /> : null}
    </span>
  );
}

/** A row's plain sentence, plus "Recommended: …" when the live state differs, for `ListRow.subtitle`. */
export function RowSubtitle({ row }: { row: Pick<SettingRow, "description" | "recommended" | "ok"> }) {
  return (
    <>
      <span className="winaudio-row__description">{row.description}</span>
      {row.ok === false && row.recommended ? <RecommendedNote recommended={row.recommended} /> : null}
    </>
  );
}

/** The live state as the row's trailing value text ("On", "48 kHz, 16-bit", "Running"). */
export function RowValue({ value }: { value: string }) {
  return <span className="winaudio-row__value">{value}</span>;
}
