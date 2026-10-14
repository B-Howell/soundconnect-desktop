// Prints the compiler-produced layout of every libmdr C ABI struct the Rust FFI
// layer mirrors. Built and run on CI (.github/workflows/engine.yml) with the same
// MSVC toolset that builds mdr-shared.dll.
//   sizes.exe            -> struct-sizes.txt:   "name sizeof alignof" per struct
//   sizes.exe --offsets  -> struct-offsets.txt: "name.field offsetof sizeof" per field
// The field lists follow the declaration order in mdr-c/Connection.h and
// mdr-c/Headphones.h at the pinned upstream commit; a renamed or removed field
// fails the CI compile, an added field must be added here by hand.
#include <cstddef>
#include <cstdio>
#include <cstring>
#include <mdr-c/Headphones.h>
#include <mdr-bt/ConnectionWindows.h>

#define MDR_PRINT_LAYOUT(T) std::printf("%s %zu %zu\n", #T, sizeof(T), alignof(T))
#define MDR_PRINT_OFFSET(T, F) std::printf("%s.%s %zu %zu\n", #T, #F, offsetof(T, F), sizeof(T::F))

static void printSizes()
{
    MDR_PRINT_LAYOUT(MDRConnection);
    MDR_PRINT_LAYOUT(MDRDeviceInfo);
    MDR_PRINT_LAYOUT(MDRModel);
    MDR_PRINT_LAYOUT(MDRBattery);
    MDR_PRINT_LAYOUT(MDRPlayback);
    MDR_PRINT_LAYOUT(MDRPlaybackCommand);
    MDR_PRINT_LAYOUT(MDRNoiseControl);
    MDR_PRINT_LAYOUT(MDRSpeakToChat);
    MDR_PRINT_LAYOUT(MDRListening);
    MDR_PRINT_LAYOUT(MDREqualizer);
    MDR_PRINT_LAYOUT(MDRPairedDevice);
    MDR_PRINT_LAYOUT(MDRPairedDeviceAction);
    MDR_PRINT_LAYOUT(MDRPairing);
    MDR_PRINT_LAYOUT(MDRGeneralSettingInfo);
    MDR_PRINT_LAYOUT(MDRGeneralSetting);
    MDR_PRINT_LAYOUT(MDRAssignableControl);
    MDR_PRINT_LAYOUT(MDRPower);
    MDR_PRINT_LAYOUT(MDRVoiceGuidance);
    MDR_PRINT_LAYOUT(MDRConnectionMode);
    MDR_PRINT_LAYOUT(MDRSafeListening);
}

static void printOffsets()
{
    MDR_PRINT_OFFSET(MDRConnection, user);
    MDR_PRINT_OFFSET(MDRConnection, connect);
    MDR_PRINT_OFFSET(MDRConnection, disconnect);
    MDR_PRINT_OFFSET(MDRConnection, recv);
    MDR_PRINT_OFFSET(MDRConnection, send);
    MDR_PRINT_OFFSET(MDRConnection, poll);
    MDR_PRINT_OFFSET(MDRConnection, getDevicesList);
    MDR_PRINT_OFFSET(MDRConnection, freeDevicesList);
    MDR_PRINT_OFFSET(MDRConnection, getLastError);
    MDR_PRINT_OFFSET(MDRDeviceInfo, szDeviceName);
    MDR_PRINT_OFFSET(MDRDeviceInfo, szDeviceMacAddress);
    MDR_PRINT_OFFSET(MDRModel, protocol_version);
    MDR_PRINT_OFFSET(MDRModel, audio_codec);
    MDR_PRINT_OFFSET(MDRModel, model_color);
    MDR_PRINT_OFFSET(MDRBattery, part);
    MDR_PRINT_OFFSET(MDRBattery, present);
    MDR_PRINT_OFFSET(MDRBattery, level_percent);
    MDR_PRINT_OFFSET(MDRBattery, update_threshold_percent);
    MDR_PRINT_OFFSET(MDRBattery, charging);
    MDR_PRINT_OFFSET(MDRPlayback, status);
    MDR_PRINT_OFFSET(MDRPlayback, volume);
    MDR_PRINT_OFFSET(MDRPlaybackCommand, action);
    MDR_PRINT_OFFSET(MDRNoiseControl, mode);
    MDR_PRINT_OFFSET(MDRNoiseControl, ambient_level);
    MDR_PRINT_OFFSET(MDRNoiseControl, changing_asm_level);
    MDR_PRINT_OFFSET(MDRNoiseControl, focus_on_voice);
    MDR_PRINT_OFFSET(MDRNoiseControl, button_mode);
    MDR_PRINT_OFFSET(MDRNoiseControl, adaptive_ambient);
    MDR_PRINT_OFFSET(MDRNoiseControl, adaptive_sensitivity);
    MDR_PRINT_OFFSET(MDRSpeakToChat, enabled);
    MDR_PRINT_OFFSET(MDRSpeakToChat, sensitivity);
    MDR_PRINT_OFFSET(MDRSpeakToChat, timeout);
    MDR_PRINT_OFFSET(MDRListening, mode);
    MDR_PRINT_OFFSET(MDRListening, background_room);
    MDR_PRINT_OFFSET(MDREqualizer, preset);
    MDR_PRINT_OFFSET(MDREqualizer, clear_bass);
    MDR_PRINT_OFFSET(MDREqualizer, band_count);
    MDR_PRINT_OFFSET(MDREqualizer, dsee_enabled);
    MDR_PRINT_OFFSET(MDREqualizer, dsee_type);
    MDR_PRINT_OFFSET(MDREqualizer, available);
    MDR_PRINT_OFFSET(MDREqualizer, dsee_available);
    MDR_PRINT_OFFSET(MDRPairedDevice, connected);
    MDR_PRINT_OFFSET(MDRPairedDevice, playback_device);
    MDR_PRINT_OFFSET(MDRPairedDevice, macAddress);
    MDR_PRINT_OFFSET(MDRPairedDevice, name);
    MDR_PRINT_OFFSET(MDRPairedDeviceAction, command);
    MDR_PRINT_OFFSET(MDRPairedDeviceAction, device_id);
    MDR_PRINT_OFFSET(MDRPairedDeviceAction, device_id_size);
    MDR_PRINT_OFFSET(MDRPairing, enabled);
    MDR_PRINT_OFFSET(MDRGeneralSettingInfo, index);
    MDR_PRINT_OFFSET(MDRGeneralSettingInfo, type);
    MDR_PRINT_OFFSET(MDRGeneralSettingInfo, writable);
    MDR_PRINT_OFFSET(MDRGeneralSetting, index);
    MDR_PRINT_OFFSET(MDRGeneralSetting, boolean_value);
    MDR_PRINT_OFFSET(MDRAssignableControl, location);
    MDR_PRINT_OFFSET(MDRAssignableControl, type);
    MDR_PRINT_OFFSET(MDRAssignableControl, action);
    MDR_PRINT_OFFSET(MDRPower, auto_power_off_minutes);
    MDR_PRINT_OFFSET(MDRPower, wearing_power);
    MDR_PRINT_OFFSET(MDRPower, auto_pause);
    MDR_PRINT_OFFSET(MDRPower, head_gesture);
    MDR_PRINT_OFFSET(MDRPower, shutdown_requested);
    MDR_PRINT_OFFSET(MDRVoiceGuidance, enabled);
    MDR_PRINT_OFFSET(MDRVoiceGuidance, volume);
    MDR_PRINT_OFFSET(MDRConnectionMode, audio_priority);
    MDR_PRINT_OFFSET(MDRSafeListening, sound_pressure);
    MDR_PRINT_OFFSET(MDRSafeListening, preview);
}

int main(int argc, char** argv)
{
    if (argc > 1 && std::strcmp(argv[1], "--offsets") == 0)
        printOffsets();
    else
        printSizes();
    return 0;
}
