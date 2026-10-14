import { describe, expect, it } from "vitest";
import { DEVICE_MODELS, deviceModelImage, findDeviceModel } from "../../src/lib/devices/models";

/** Every PNG shipped in public/devices/, keyed "/public/devices/<file>" (only the keys are used; nothing is loaded). */
const shipped = new Set(Object.keys(import.meta.glob("/public/devices/*.png")));

describe("device models", () => {
  it("lists exactly the photos shipped in public/devices", () => {
    expect(shipped.size).toBe(DEVICE_MODELS.length * 2);
  });

  it("has a full photo and a thumbnail on disk for every model", () => {
    for (const { id } of DEVICE_MODELS) {
      const { image, thumb } = deviceModelImage(id);
      expect(image).toBe(`/devices/${id}.png`);
      expect(thumb).toBe(`/devices/${id}-thumb.png`);
      expect(shipped.has(`/public${image}`), image).toBe(true);
      expect(shipped.has(`/public${thumb}`), thumb).toBe(true);
    }
  });

  it("matches model ids case-insensitively, with regional suffixes, and LinkBuds product names", () => {
    expect(findDeviceModel("WH-1000XM4")?.id).toBe("WH-1000XM4");
    expect(findDeviceModel("  wh-1000xm4 ")?.id).toBe("WH-1000XM4");
    expect(findDeviceModel("WH-1000XM4C")?.id).toBe("WH-1000XM4");
    expect(findDeviceModel("WF-1000XM5")?.id).toBe("WF-1000XM5");
    expect(findDeviceModel("LinkBuds S")?.id).toBe("WF-LS900N");
    expect(findDeviceModel("LinkBuds Open")?.id).toBe("WF-L910");
    expect(findDeviceModel("LinkBuds Clip")?.id).toBe("WF-LC900");
    expect(findDeviceModel("WF-LS900N")?.displayName).toBe("LinkBuds S");
    expect(findDeviceModel("Pixel Buds")).toBeNull();
    expect(findDeviceModel("")).toBeNull();
    expect(findDeviceModel(undefined)).toBeNull();
  });

  it("falls back to the XM5 photo of the family, and to the WH-1000XM5 when nothing is known", () => {
    expect(deviceModelImage("WH-1000XM9").model.id).toBe("WH-1000XM5");
    expect(deviceModelImage("WF-C999").model.id).toBe("WF-1000XM5");
    expect(deviceModelImage("LinkBuds Fit").model.id).toBe("WF-1000XM5");
    expect(deviceModelImage("Headphones").model.id).toBe("WH-1000XM5");
    expect(deviceModelImage(null).model.id).toBe("WH-1000XM5");
  });
});
