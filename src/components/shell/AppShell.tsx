import { useId, type ComponentType } from "react";
import { useAlertBannerProps } from "../../hooks/engine/useAlertBannerProps";
import { useConnectionAnnouncement } from "../../hooks/engine/useConnectionAnnouncement";
import { useRailDeviceProps } from "../../hooks/engine/useRailDeviceProps";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { DevicesPage } from "../../pages/DevicesPage";
import { EqualizerPage } from "../../pages/EqualizerPage";
import { NoiseControlPage } from "../../pages/NoiseControlPage";
import { SettingsPage } from "../../pages/SettingsPage";
import { SoundPage } from "../../pages/SoundPage";
import { StatusPage } from "../../pages/StatusPage";
import { SystemPage } from "../../pages/SystemPage";
import { WindowsAudioPage } from "../../pages/WindowsAudioPage";
import { useNavStore, type NavPage } from "../../state/navStore";
import { AppFrame } from "../frame/AppFrame";
import { navPages, navTrail } from "../frame/navPages";
import { NavRail } from "../frame/NavRail";
import { RailDevice } from "../frame/RailDevice";
import { SideNav } from "../frame/SideNav";
import { PageTitle } from "../page/PageTitle";
import { AlertBanner } from "./AlertBanner";
import { UpdateBannerHost } from "../updates/UpdateBannerHost";
import { useAutoUpdateCheck } from "../../hooks/updates/useAutoUpdateCheck";
import { ConnectionAnnouncer } from "./ConnectionAnnouncer";
import "./AppShell.css";

const pages: Record<NavPage, ComponentType> = {
  status: StatusPage,
  sound: SoundPage,
  equalizer: EqualizerPage,
  noise: NoiseControlPage,
  system: SystemPage,
  devices: DevicesPage,
  windowsAudio: WindowsAudioPage,
  settings: SettingsPage,
};

/** Below this window width the rail is icon-only (72 px). */
export const RAIL_COLLAPSED_QUERY = "(max-width: 999.98px)";

/**
 * The running app: the desktop frame with the navigation rail (device block
 * and the pages, Sound's sub-pages under it) on the left and the open page on
 * the right, under its `<h1>` (a sub-page's with a "Sound ›" breadcrumb back
 * to its parent), cross-faded on every switch. Above the page sits the banner for a
 * message from the headphones; outside the page transition sit the
 * connection announcer's live regions, so they stay mounted across page
 * switches.
 */
export function AppShell() {
  const page = useNavStore((state) => state.page);
  const setPage = useNavStore((state) => state.setPage);
  const collapsed = useMediaQuery(RAIL_COLLAPSED_QUERY);
  const idPrefix = useId();
  // One id per page: the leaving page's heading is still in the document while it fades.
  const headingId = `${idPrefix}-${page}-title`;
  const Page = pages[page];
  const title = navPages.find((item) => item.value === page)?.label ?? "";
  const trail = navTrail(navPages, page).map((item) => ({ label: item.label, onSelect: () => setPage(item.value) }));
  const announcement = useConnectionAnnouncement();
  const alert = useAlertBannerProps();
  const device = useRailDeviceProps();
  useAutoUpdateCheck();

  return (
    <>
      <ConnectionAnnouncer {...announcement} />
      <AppFrame
        wordmark="SoundConnect"
        pageKey={page}
        nav={
          <NavRail wordmark="SoundConnect" collapsed={collapsed} device={<RailDevice {...device} collapsed={collapsed} />}>
            <SideNav label="Pages" items={navPages} value={page} onChange={setPage} collapsed={collapsed} />
          </NavRail>
        }
        heading={
          <PageTitle id={headingId} trail={trail}>
            {title}
          </PageTitle>
        }
      >
        <div className="app-shell__page" role="region" aria-labelledby={headingId}>
          <UpdateBannerHost />
          {alert ? <AlertBanner {...alert} /> : null}
          <Page />
        </div>
      </AppFrame>
    </>
  );
}
