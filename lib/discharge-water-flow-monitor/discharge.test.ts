import { describe, expect, it } from "vitest";
import { createDischargeWaterFlowMonitorDemo } from "./demo";
import { formatVolume, VOLUME_UNITS } from "./volume-units";

// Plain numbers with no separators, so the checks don't depend on the machine's locale.
const plain = (text: string) => Number(text.replace(/[^\d.-]/g, ""));

describe("formatVolume", () => {
  it("converts US gallons into each unit", () => {
    expect(plain(formatVolume(1_000, "gal"))).toBe(1_000);
    expect(plain(formatVolume(1_000, "L"))).toBe(3_785);
    expect(plain(formatVolume(1_000, "m³"))).toBe(3.79);
    expect(plain(formatVolume(1_000, "ft³"))).toBe(133.7);
    expect(plain(formatVolume(325_851.4, "ac-ft"))).toBe(1);
  });

  it("shows each unit's usual number of decimals", () => {
    for (const [unit, { precision }] of Object.entries(VOLUME_UNITS)) {
      const decimals = formatVolume(1_234.5678, unit as keyof typeof VOLUME_UNITS).split(/[.,]/).at(-1)!;
      if (precision > 0) expect(decimals, unit).toHaveLength(precision);
    }
  });

  it("formats zero", () => {
    expect(plain(formatVolume(0, "m³"))).toBe(0);
  });
});

describe("the discharge water flow monitor demo", () => {
  it("adds to the total volume as water flows", () => {
    const demo = createDischargeWaterFlowMonitorDemo();
    const first = demo.tick().total_volume!;
    for (let i = 0; i < 100; i++) demo.tick();
    expect(demo.tick().total_volume!).toBeGreaterThan(first);
  });

  it("resets the total", () => {
    const demo = createDischargeWaterFlowMonitorDemo();
    demo.tick();
    expect(demo.action("reset_total")).toEqual({ total_volume: 0 });
    expect(demo.tick().total_volume!).toBeLessThan(1_000);
  });

  it("scales the flow with the flow-per-volt setting, and refuses one that isn't above 0", () => {
    const demo = createDischargeWaterFlowMonitorDemo();
    const before = demo.action("get_reading");
    const doubled = demo.setting("set_flow_per_volt", String(before.flow_per_volt! * 2));
    expect(doubled.flow_rate).toBeCloseTo(before.flow_rate! * 2, 0);

    for (const bad of ["0", "-1", "abc", "Infinity"]) {
      expect(demo.setting("set_flow_per_volt", bad), bad).toHaveProperty("error");
    }
  });
});
