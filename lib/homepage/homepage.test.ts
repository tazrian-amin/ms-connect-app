// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { contactEmailHref } from "@/lib/contact";
import { formatVolume } from "@/lib/discharge-water-flow-monitor/volume-units";
import { devices, filterDevices, getDevice } from "./devices";

describe("filterDevices", () => {
  it("shows every device for an empty search", () => {
    expect(filterDevices("")).toBe(devices);
    expect(filterDevices("   ")).toBe(devices);
  });

  it("matches name or description, ignoring case and surrounding spaces", () => {
    expect(filterDevices("  CONVEYOR ").map((device) => device.slug)).toEqual([
      "conveyor-volumetric-scale",
      "conveyor-volumetric-scale-pro",
    ]);
    expect(filterDevices("battery").map((device) => device.slug)).toEqual(["asset-tracker"]);
    expect(filterDevices("toaster")).toEqual([]);
  });

  it("has a unique slug per device, each found by getDevice", () => {
    const slugs = devices.map((device) => device.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(getDevice(slug)?.slug).toBe(slug);
    expect(getDevice("nope")).toBeUndefined();
  });
});

describe("contactEmailHref", () => {
  it("links to the team, with spaces as %20 rather than +", () => {
    const href = contactEmailHref("Order enquiry: Pump", ["Device: Pump", false, null, "Rating: 5 out of 5"]);
    expect(href).toMatch(/^mailto:[^?]+@[^?]+\?subject=Order%20enquiry%3A%20Pump&body=/);
    expect(href).not.toContain("+");
    expect(decodeURIComponent(href.split("body=")[1])).toBe("Device: Pump\nRating: 5 out of 5");
  });

  it("is a bare address without a subject or body", () => {
    expect(contactEmailHref()).toMatch(/^mailto:[^?]+$/);
  });
});

describe("formatVolume", () => {
  it("converts from US gallons with each unit's precision", () => {
    expect(formatVolume(1000, "gal")).toBe((1000).toLocaleString());
    expect(formatVolume(1000, "L")).toBe((3785).toLocaleString());
    expect(formatVolume(1000, "m³")).toBe((3.79).toLocaleString(undefined, { minimumFractionDigits: 2 }));
    expect(formatVolume(1000, "ft³")).toBe((133.7).toLocaleString(undefined, { minimumFractionDigits: 1 }));
    expect(formatVolume(325_851.4, "ac-ft")).toBe((1).toLocaleString(undefined, { minimumFractionDigits: 3 }));
  });
});
