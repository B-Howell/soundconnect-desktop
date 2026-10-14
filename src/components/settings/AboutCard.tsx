import { APP_VERSION, ENGINE_COMMIT, ENGINE_UPSTREAM_URL, shortCommit } from "../../lib/buildInfo";
import { GroupedList } from "../primitives/GroupedList";
import { ListRow } from "../primitives/ListRow";
import { SectionFooter } from "../primitives/SectionFooter";
import { AboutHeader } from "./AboutHeader";
import { BreakableUrl } from "./BreakableUrl";
import { LicensesRow } from "./LicensesRow";
import "./AboutCard.css";

export const APP_NAME = "SoundConnect Desktop";
export const CREDITS_LINE =
  "Protocol engine: libmdr by mos9527 and contributors; original SonyHeadphonesClient by Plutoberth (MIT)";
export const SONY_DISCLAIMER = "Not affiliated with, endorsed by, or supported by Sony.";

export interface AboutCardProps {
  /** Defaults to package.json's version (Vite `define`). */
  version?: string;
  /** Full upstream engine commit; defaults to the build-time submodule gitlink. */
  engineCommit?: string;
  upstreamUrl?: string;
}

/**
 * Settings' About block: icon, name and version; the engine's commit and
 * source; the licences sheet; then credits and the Sony disclaimer as the
 * group footer. Build facts are props defaulting to the build constants, so
 * tests can pass fixed values.
 */
export function AboutCard({
  version = APP_VERSION,
  engineCommit = ENGINE_COMMIT,
  upstreamUrl = ENGINE_UPSTREAM_URL,
}: AboutCardProps) {
  return (
    <>
      <AboutHeader name={APP_NAME} version={version} />
      <GroupedList aria-label="About">
        <ListRow
          title="Engine commit"
          trailing={
            <span className="about-card__commit" title={engineCommit}>
              {shortCommit(engineCommit)}
            </span>
          }
        />
        <ListRow title="Engine source" subtitle={<BreakableUrl url={upstreamUrl} />} />
        <LicensesRow />
      </GroupedList>
      <SectionFooter>
        <p>{CREDITS_LINE}</p>
        <p>{SONY_DISCLAIMER}</p>
      </SectionFooter>
    </>
  );
}
