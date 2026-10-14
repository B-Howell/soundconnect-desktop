import { useRef } from "react";
import { useSheet } from "../../hooks/useSheet";
import { OWN_LICENSE_LINE, UPSTREAM_LICENSE_PARAGRAPHS } from "../../lib/licenses";
import { ListRow } from "../primitives/ListRow";
import { SectionFooter } from "../primitives/SectionFooter";
import { Sheet } from "../primitives/Sheet";
import { LicenseText } from "./LicenseText";
import "./LicensesRow.css";

/**
 * "View licenses" row (inside a `<ul>`) opening a sheet with the upstream
 * engine's MIT licence, inlined at build time, and our own (also MIT).
 */
export function LicensesRow() {
  const sheet = useSheet();
  const firstLicense = useRef<HTMLElement>(null);
  return (
    <>
      <ListRow title="View licenses" disclosure onPress={sheet.show} />
      <Sheet open={sheet.open} onClose={sheet.hide} title="Licenses" initialFocus={firstLicense}>
        <div className="licenses-row__sheet">
          <LicenseText ref={firstLicense} heading="SonyHeadphonesClient and libmdr" paragraphs={UPSTREAM_LICENSE_PARAGRAPHS} />
          <SectionFooter>
            <p>{OWN_LICENSE_LINE}</p>
          </SectionFooter>
        </div>
      </Sheet>
    </>
  );
}
