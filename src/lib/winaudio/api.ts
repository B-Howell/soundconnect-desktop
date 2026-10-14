import { invoke } from "@tauri-apps/api/core";
import type { Change, ChangeResult, FixKind, Plan, SettingsPage, WinAudioSnapshot } from "./types";

/**
 * The Windows audio commands (`src-tauri/src/winaudio_commands.rs`), one
 * method each. `tauriWinAudioApi` invokes them; `createMockWinAudioApi`
 * serves the recording of the maintainer's PC in the browser and in tests.
 */
export interface WinAudioApi {
  /** `winaudio_snapshot`: the state for the headphones at `address`; `codec` is echoed. */
  snapshot(address: string, codec: string | null): Promise<WinAudioSnapshot>;
  /** `winaudio_fix_preset`: what a fix would change, for the preview. */
  fixPreset(kind: FixKind, address: string, codec: string | null): Promise<Plan>;
  /** `winaudio_apply`: user-level changes, each read back. */
  apply(address: string, changes: Change[]): Promise<ChangeResult[]>;
  /** `winaudio_apply_admin`: admin changes in the elevated helper (one Windows prompt). */
  applyAdmin(address: string, changes: Change[]): Promise<ChangeResult[]>;
  /** `winaudio_restore`: puts the restore point back. */
  restore(codec: string | null): Promise<ChangeResult[]>;
  /** `winaudio_restore_point`: the saved pre-fix state, if any. */
  restorePoint(): Promise<WinAudioSnapshot | null>;
  /** `winaudio_forget_restore_point` */
  forgetRestorePoint(): Promise<void>;
  /** `winaudio_open_settings` */
  openSettings(page: SettingsPage): Promise<void>;
}

export const tauriWinAudioApi: WinAudioApi = {
  snapshot: (address, codec) => invoke("winaudio_snapshot", { address, codec }),
  fixPreset: (kind, address, codec) => invoke("winaudio_fix_preset", { kind, address, codec }),
  apply: (address, changes) => invoke("winaudio_apply", { address, changes }),
  applyAdmin: (address, changes) => invoke("winaudio_apply_admin", { address, changes }),
  restore: (codec) => invoke("winaudio_restore", { codec }),
  restorePoint: () => invoke("winaudio_restore_point"),
  forgetRestorePoint: () => invoke("winaudio_forget_restore_point"),
  openSettings: (page) => invoke("winaudio_open_settings", { page }),
};
