import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeviceImage } from "../../src/components/device-art/DeviceImage";
import { DeviceHeader } from "../../src/components/shell/DeviceHeader";
import { RailDevice } from "../../src/components/frame/RailDevice";
import { ConnectionSearching } from "../../src/components/shell/ConnectionSearching";
import { ConnectionConnecting } from "../../src/components/shell/ConnectionConnecting";

describe("DeviceImage", () => {
  it("shows the model's Sony photo in a square box, unfiltered and eagerly loaded", () => {
    render(<DeviceImage model="WH-1000XM4" size={160} />);
    const img = screen.getByRole("img", { name: "WH-1000XM4" });
    expect(img).toHaveAttribute("src", "/devices/WH-1000XM4.png");
    expect(img).toHaveAttribute("width", "160");
    expect(img).toHaveAttribute("height", "160");
    expect(img).toHaveAttribute("loading", "eager");
    expect(img.getAttribute("style")).toBeNull();
  });

  it("loads the thumbnail for the thumb variant and names LinkBuds by product name", () => {
    render(<DeviceImage model="WF-LS900N" size={40} variant="thumb" />);
    expect(screen.getByRole("img", { name: "LinkBuds S" })).toHaveAttribute("src", "/devices/WF-LS900N-thumb.png");
  });

  it("uses the family fallback photo for an unknown model but keeps the device's own name", () => {
    render(<DeviceImage model="WF-C999" size={64} />);
    const img = screen.getByRole("img", { name: "WF-C999" });
    expect(img).toHaveAttribute("src", "/devices/WF-1000XM5.png");
  });

  it("shows the neutral WH-1000XM5 photo when no model is known", () => {
    render(<DeviceImage size={64} />);
    expect(screen.getByRole("img", { name: "Headphones" })).toHaveAttribute("src", "/devices/WH-1000XM5.png");
  });
});

describe("product photos in place", () => {
  it("puts the large photo in the device header", () => {
    render(<DeviceHeader name="WH-1000XM4" charging={false} />);
    expect(screen.getByRole("img", { name: "WH-1000XM4" })).toHaveAttribute("src", "/devices/WH-1000XM4.png");
  });

  it("puts the thumbnail in the rail, expanded and collapsed", () => {
    const { rerender } = render(<RailDevice name="WH-1000XM4" state="Connected" connected />);
    expect(screen.getByRole("img", { name: "WH-1000XM4" })).toHaveAttribute("src", "/devices/WH-1000XM4-thumb.png");
    rerender(<RailDevice name="WH-1000XM4" state="Connected" connected collapsed />);
    expect(screen.getByRole("img", { name: "WH-1000XM4" })).toHaveAttribute("width", "40");
  });

  it("shows the named device on the connection screens, else the neutral photo", () => {
    const { unmount } = render(<ConnectionConnecting deviceName="WH-1000XM4" />);
    expect(screen.getByRole("img", { name: "WH-1000XM4" })).toHaveAttribute("src", "/devices/WH-1000XM4.png");
    unmount();
    render(<ConnectionSearching />);
    expect(screen.getByRole("img", { name: "Headphones" })).toHaveAttribute("src", "/devices/WH-1000XM5.png");
  });
});
