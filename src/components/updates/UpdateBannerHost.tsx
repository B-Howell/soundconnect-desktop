import { useState } from "react";
import { useStore } from "zustand";
import { useUpdateBannerProps } from "../../hooks/updates/useUpdateBannerProps";
import { useUpdaterStore, type UpdaterStore } from "../../state/updaterStore";
import { UpdateBanner } from "./UpdateBanner";
import { UpdateNotesSheet } from "./UpdateNotesSheet";

/** The update banner and its release-notes sheet, fed by the updater store (a test passes its own). */
export function UpdateBannerHost({ store = useUpdaterStore }: { store?: UpdaterStore }) {
  const [notesOpen, setNotesOpen] = useState(false);
  const banner = useUpdateBannerProps(store, () => setNotesOpen(true));
  const update = useStore(store, (s) => s.update);
  return (
    <>
      {banner ? <UpdateBanner {...banner} /> : null}
      {update ? (
        <UpdateNotesSheet
          open={notesOpen}
          version={update.version}
          notes={update.notes}
          onClose={() => setNotesOpen(false)}
        />
      ) : null}
    </>
  );
}
