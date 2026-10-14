import { useRememberedDevice } from "../../hooks/setup/useRememberedDevice";
import { rememberedTitle, UNNAMED_HEADPHONES } from "../../lib/devices/deviceTitle";
import { useEngineStoreApi } from "../../state/engineContext";
import { useSetupStore } from "../../state/setupStore";
import { AutoConnectRow } from "./AutoConnectRow";
import { ForgetHeadphonesRow } from "./ForgetHeadphonesRow";
import { SetUpHeadphonesRow } from "./SetUpHeadphonesRow";

/**
 * The Settings page's Headphones rows (place inside a `GroupedList`):
 * auto-connect, "Set up new headphones" (reopens the wizard at "Pair with
 * Windows") and, while headphones are remembered, "Forget these headphones"
 * (`forgetDevice`).
 */
export function HeadphonesRows() {
  const remembered = useRememberedDevice();
  const openSetup = useSetupStore((state) => state.openSetup);
  const store = useEngineStoreApi();
  return (
    <>
      <AutoConnectRow />
      <SetUpHeadphonesRow
        onPress={() => {
          // A failure from an earlier Connect must not greet the new setup.
          store.getState().clearAttempt();
          openSetup("pair");
        }}
      />
      {remembered ? (
        <ForgetHeadphonesRow
          name={rememberedTitle(remembered) ?? UNNAMED_HEADPHONES}
          onConfirm={() => store.getState().forgetDevice(remembered.address)}
        />
      ) : null}
    </>
  );
}
