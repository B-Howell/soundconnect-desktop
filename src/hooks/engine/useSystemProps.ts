import { useMemo } from "react";
import { ALL_AUTO_POWER_OFF_OPTIONS, V1_AUTO_POWER_OFF_OPTIONS } from "../../components/system/autoPowerOff";
import type { DeviceSettingsCardProps } from "../../components/system/DeviceSettingsCard";
import { generalSettingSubject, generalSettingSummary } from "../../components/system/generalSettingLabels";
import type { PowerOffRowProps } from "../../components/system/PowerOffRow";
import type { VoiceGuidanceRowProps } from "../../components/system/VoiceGuidanceRow";
import { MULTIPOINT_SUBJECT } from "../../lib/engine/applyCommand";
import { hasFeature, type EngineCommand, type Snapshot } from "../../lib/engine/types";
import { useEngine } from "../../state/engineContext";
import { useEngineSend } from "./useEngineCommand";
import { toAutoPauseProps } from "./useAutoPauseProps";

export interface SystemProps {
  device?: DeviceSettingsCardProps;
  voiceGuidance?: VoiceGuidanceRowProps;
  power?: PowerOffRowProps;
}

/**
 * System's sections from the snapshot, each only with its feature:
 * - Device: boolean general settings (`GENERAL_SETTINGS`) except
 *   `MULTIPOINT_SETTING`, which the Devices page shows; on the XM4 that is
 *   the touch sensor control panel. Named from their subject / summary keys,
 *   read-only when not writable or unnamed (upstream's
 *   `BeginDisabled(subjectKey.empty() || !info.writable)`), written with
 *   `setGeneralSetting {index, value}`. Then automatic pause (`AUTO_PAUSE`,
 *   `setAutoPause`) and auto power off (`AUTO_POWER_OFF`), 0 minutes shown
 *   as Never, the V1 list on protocol V1, written with
 *   `setPower {autoPowerOffMinutes}`.
 * - Notification & voice guide (`VOICE_GUIDANCE`): `setVoiceGuidance
 *   {enabled}`, a volume only with `VOICE_GUIDANCE_VOLUME`.
 * - Power (`SHUTDOWN`): power off, confirmed in the sheet, sends `powerOff`.
 * The NC/AMB button's function moved to the Noise control page
 * (`useAssignableControlsProps`).
 */
export function toSystemProps(snapshot: Snapshot, send: (command: EngineCommand) => void): SystemProps {
  const deviceName = snapshot.texts.modelName ?? "Headphones";
  const settings = hasFeature(snapshot, "GENERAL_SETTINGS") ? (snapshot.generalSettings ?? []) : [];
  const voice = hasFeature(snapshot, "VOICE_GUIDANCE") ? snapshot.voiceGuidance : null;
  const power = hasFeature(snapshot, "AUTO_POWER_OFF") ? snapshot.power : null;
  const autoPause = toAutoPauseProps(snapshot, send) ?? undefined;
  const withVolume = hasFeature(snapshot, "VOICE_GUIDANCE_VOLUME");

  const generalSettings = settings
    .filter((setting) => setting.info.kind === "boolean" && setting.subject !== MULTIPOINT_SUBJECT)
    .map((setting) => ({
      index: setting.index,
      subject: generalSettingSubject(setting.subject),
      summary: generalSettingSummary(setting.summary),
      value: setting.value,
      writable: setting.info.writable && setting.subject !== "",
    }));

  const device: DeviceSettingsCardProps | undefined =
    generalSettings.length > 0 || autoPause || power
      ? {
          generalSettings,
          onGeneralSettingChange: (index, value) => send({ type: "setGeneralSetting", index, value }),
          autoPause,
          autoPowerOff: power
            ? {
                options: snapshot.protocol === "V1" ? V1_AUTO_POWER_OFF_OPTIONS : ALL_AUTO_POWER_OFF_OPTIONS,
                value: power.autoPowerOffMinutes === 0 ? null : power.autoPowerOffMinutes,
                onChange: (minutes) => send({ type: "setPower", autoPowerOffMinutes: minutes ?? 0 }),
              }
            : undefined,
        }
      : undefined;

  const voiceGuidance: VoiceGuidanceRowProps | undefined = voice
    ? {
        enabled: voice.enabled,
        onEnabledChange: (enabled) => send({ type: "setVoiceGuidance", enabled }),
        ...(withVolume
          ? {
              volume: voice.volume,
              onVolumeCommit: (volume: number) => send({ type: "setVoiceGuidance", enabled: voice.enabled, volume }),
            }
          : {}),
      }
    : undefined;

  return {
    device,
    voiceGuidance,
    power: hasFeature(snapshot, "SHUTDOWN") ? { deviceName, onConfirm: () => send({ type: "powerOff" }) } : undefined,
  };
}

/** The System page's sections for the connected device. */
export function useSystemProps(): SystemProps {
  const snapshot = useEngine((state) => state.payload?.snapshot ?? null);
  const send = useEngineSend();
  return useMemo(() => (snapshot ? toSystemProps(snapshot, send) : {}), [snapshot, send]);
}
