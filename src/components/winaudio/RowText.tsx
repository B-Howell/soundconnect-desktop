import type { SettingRow } from "../../lib/winaudio/rows";
import { AdminShield } from "./AdminShield";
import { RowStatus } from "./RowStatus";
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

/** A row's plain sentence and its live / recommended line, for `ListRow.subtitle`. */
export function RowSubtitle({ row }: { row: Pick<SettingRow, "description" | "current" | "recommended" | "ok"> }) {
  return (
    <>
      <span className="winaudio-row__description">{row.description}</span>
      <RowStatus current={row.current} recommended={row.recommended} ok={row.ok} />
    </>
  );
}
