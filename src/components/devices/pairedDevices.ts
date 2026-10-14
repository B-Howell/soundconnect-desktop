/** What the Devices page can ask the headphones to do with one paired device (`setPairedDevice.command`). */
export type PairedDeviceActionName = "connect" | "disconnect" | "selectPlayback" | "unpair";

/** One paired device as the Devices page shows it. */
export interface PairedDeviceView {
  /** The device's Bluetooth address, the `deviceId` of its commands. */
  id: string;
  name: string;
  connected: boolean;
  /** The device whose audio the headphones play (multipoint). */
  playback: boolean;
  /** This computer: the page leaves its disconnect and forget to Windows. */
  thisPc: boolean;
  /**
   * Connected while two devices are and this PC cannot be told apart: it may
   * be this PC, so disconnect and forget are not offered either (they could
   * cut the app's own link).
   */
  maybeThisPc?: boolean;
  /** The action sent and not yet reported done, if any. */
  pending?: PairedDeviceActionName;
}

/** The line a row shows while an action is under way. */
export const pendingLabels: Record<PairedDeviceActionName, string> = {
  connect: "Connecting…",
  disconnect: "Disconnecting…",
  selectPlayback: "Switching playback…",
  unpair: "Forgetting…",
};

/** The actions offered for a device in its current state, in Sony's order. */
export function pairedDeviceActions(device: PairedDeviceView): PairedDeviceActionName[] {
  if (device.thisPc || device.maybeThisPc) return device.playback ? [] : ["selectPlayback"];
  const actions: PairedDeviceActionName[] = [];
  if (device.connected) {
    if (!device.playback) actions.push("selectPlayback");
    actions.push("disconnect");
  } else {
    actions.push("connect");
  }
  actions.push("unpair");
  return actions;
}

/** Button text for each action. */
export const actionLabels: Record<PairedDeviceActionName, string> = {
  connect: "Connect",
  disconnect: "Disconnect",
  selectPlayback: "Set as playback device",
  unpair: "Forget this device",
};
