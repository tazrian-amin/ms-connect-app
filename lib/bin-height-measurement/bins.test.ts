// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBinHeightMeasurementDemo } from "./demo";

// The bin list lives in localStorage and in module state, so each test loads the module afresh.
let bins: typeof import("./bins");
const STORAGE_KEY = "bin-height-measurement:bins";
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
const names = () => stored().map((bin: { name: string }) => bin.name);
const add = (name: string) => bins.addBin({ name, category: "basic-storage", materialType: "solid" });

beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  bins = await import("./bins");
});

describe("bin names", () => {
  it("suggests the next free number", () => {
    expect(bins.suggestBinName()).toBe("Bin 1");
    add("Bin 1");
    add("Bin 3");
    expect(bins.suggestBinName()).toBe("Bin 4");
  });

  it("must be filled in, short enough and unique (ignoring case and spaces)", () => {
    expect(bins.validateBinName("   ")).toBe("Enter a name.");
    expect(bins.validateBinName("x".repeat(41))).toBe("Use at most 40 characters.");
    expect(bins.validateBinName("x".repeat(40))).toBeNull();

    const hopper = add("  Hopper ");
    expect(hopper.name).toBe("Hopper");
    expect(bins.validateBinName("HOPPER ")).toBe("Another bin already has this name.");
    // A bin may keep its own name when renamed.
    expect(bins.validateBinName("hopper", hopper.id)).toBeNull();
  });
});

describe("the bin list", () => {
  it("is saved in order, and renames and removals are saved too", () => {
    const a = add("A");
    add("B");
    const c = add("C");
    expect(names()).toEqual(["A", "B", "C"]);

    bins.renameBin(a.id, "  Alpha ");
    bins.removeBin(c.id);
    expect(names()).toEqual(["Alpha", "B"]);
  });

  it("moves a bin, clamping the target position", () => {
    const a = add("A");
    add("B");
    add("C");
    bins.moveBin(a.id, 99);
    expect(names()).toEqual(["B", "C", "A"]);
    bins.moveBin(a.id, -5);
    expect(names()).toEqual(["A", "B", "C"]);
    bins.moveBin("missing", 0);
    expect(names()).toEqual(["A", "B", "C"]);
  });

  it("keeps only #rrggbb material colours", () => {
    const bin = bins.addBin({ name: "A", category: "basic-hopper", materialType: "liquid", materialColor: "red" });
    expect(stored()[0]).not.toHaveProperty("materialColor");

    bins.setBinMaterialColor(bin.id, "#12AbEf");
    expect(stored()[0].materialColor).toBe("#12AbEf");
    bins.setBinMaterialColor(bin.id, "#123");
    expect(stored()[0].materialColor).toBe("#12AbEf");
  });

  it("gives bins saved before categories existed the shape they were drawn as", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: "old", name: "Old bin" }]));
    vi.resetModules();
    bins = await import("./bins");
    add("New");
    expect(stored()[0]).toMatchObject({ id: "old", category: "industrial-hopper", materialType: "solid" });
  });

  it("starts empty when the saved list is corrupt or invalid", async () => {
    for (const bad of ["{not json", JSON.stringify([{ id: 1, name: "x" }]), JSON.stringify({ id: "a" })]) {
      localStorage.setItem(STORAGE_KEY, bad);
      vi.resetModules();
      bins = await import("./bins");
      expect(bins.suggestBinName()).toBe("Bin 1");
    }
  });
});

describe("isHexColor", () => {
  it("accepts only six-digit hex colours", () => {
    expect(bins.isHexColor("#a1B2c3")).toBe(true);
    for (const value of ["#abc", "a1b2c3", "#ggg000", "#a1b2c3d4", 123, null]) {
      expect(bins.isHexColor(value)).toBe(false);
    }
  });
});

describe("the bin height demo", () => {
  it("keeps the reading within the sensor's 12-bit range while filling and discharging", () => {
    const demo = createBinHeightMeasurementDemo();
    const heights = Array.from({ length: 2_000 }, () => demo.tick().material_height!);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...heights)).toBeLessThanOrEqual(4095);
    // It goes both ways over a long run, rather than getting stuck full or empty.
    const rises = heights.filter((h, i) => i > 0 && h > heights[i - 1]).length;
    expect(rises).toBeGreaterThan(100);
    expect(rises).toBeLessThan(1_900);
  });

  it("checks the sample period and device ID like the firmware", () => {
    const demo = createBinHeightMeasurementDemo();
    expect(demo.setting("set_sample_period_ms", "999")).toHaveProperty("error");
    expect(demo.setting("set_sample_period_ms", "3600001")).toHaveProperty("error");
    expect(demo.setting("set_sample_period_ms", "1500.5")).toHaveProperty("error");
    expect(demo.setting("set_sample_period_ms", "5000")).toMatchObject({ sample_period_ms: 5000 });
    expect(demo.intervalMs).toBe(5000);

    const original = demo.deviceId;
    expect(demo.setting("set_device_id", "")).toHaveProperty("error");
    expect(demo.setting("set_device_id", "é")).toHaveProperty("error");
    expect(demo.setting("set_device_id", "x".repeat(128))).toHaveProperty("error");
    demo.setting("set_device_id", "BIN-NORTH");
    expect(demo.deviceId).toBe("BIN-NORTH");
    demo.action("reset_config");
    expect(demo.deviceId).toBe(original);
  });

  it("reports the clock as synced once the time is set", () => {
    const demo = createBinHeightMeasurementDemo();
    expect(demo.action("get_config")).toMatchObject({ time_synced: false });
    demo.setting("set_time", String(Date.now()));
    expect(demo.action("get_config")).toMatchObject({ time_synced: true });
  });
});
