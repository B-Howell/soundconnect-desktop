import { useState } from "react";
import {
  AssignableControlsCard,
  type AssignableActionOption,
  type AssignableControl,
} from "../../components/system/AssignableControlsCard";
import { assignableActionLabel } from "../../components/system/assignableLabels";
import { V1_AUTO_POWER_OFF_OPTIONS, type AutoPowerOffMinutes } from "../../components/system/autoPowerOff";
import { SystemSections } from "../../components/system/SystemSections";

/**
 * What the v1 family offers for its NC/AMB button (upstream
 * docs/device-support/WH-1000XM3.md: "NC/AMB, Google Assistant, Amazon
 * Alexa"), as `MDR_ASSIGNABLE_*` ids. Demo data for the gallery only.
 */
const ncAmbActions: readonly AssignableActionOption[] = [2, 6, 7].map((action) => ({
  action,
  label: assignableActionLabel(action),
}));

const NC_AMB_LOCATION = 5;
const BUTTON_TYPE = 2;

/**
 * The System page on local state: the touch panel switch (index 2, as the
 * XM3's `GENERAL_SETTING2`), voice guidance without a volume (v1 has none),
 * the v1 auto power off choices, the NC/AMB button's function and the power
 * off confirmation. Writes are logged where Task 11 will send commands.
 */
export function SystemDemo() {
  const [touchPanel, setTouchPanel] = useState(true);
  const [voice, setVoice] = useState(true);
  const [powerOff, setPowerOff] = useState<AutoPowerOffMinutes>(30);
  const [ncAmbAction, setNcAmbAction] = useState(2);

  const controls: AssignableControl[] = [
    {
      location: NC_AMB_LOCATION,
      type: BUTTON_TYPE,
      action: ncAmbAction,
      actionLabel: assignableActionLabel(ncAmbAction),
    },
  ];

  return (
    <>
      <AssignableControlsCard
        controls={controls}
        actions={ncAmbActions}
        onChange={(location, action) => {
          console.info("[gallery] assignable", location, action);
          setNcAmbAction(action);
        }}
      />
      <SystemSections
        device={{
          generalSettings: [
            {
              index: 2,
              // Upstream's name for TOUCH_PANEL_SETTING; the device sends no summary for it.
              subject: "Touch sensor control panel",
              value: touchPanel,
              writable: true,
            },
          ],
          onGeneralSettingChange: (index, value) => {
            console.info("[gallery] general setting", index, value);
            setTouchPanel(value);
          },
          autoPowerOff: {
            options: V1_AUTO_POWER_OFF_OPTIONS,
            value: powerOff,
            onChange: setPowerOff,
          },
        }}
        voiceGuidance={{ enabled: voice, onEnabledChange: setVoice }}
        power={{
          deviceName: "WH-1000XM4",
          onConfirm: () => console.info("[gallery] power off confirmed"),
        }}
      />
    </>
  );
}
