import { dewaterWaterLevelMonitorCommands } from "@/lib/bluetooth/commands/dewater-water-level-monitor";
import { drift, type DemoSimulator } from "@/lib/bluetooth/demo";

const INTERVAL_MS = 2_000;

/**
 * A sump that slowly fills and is pumped down again, so the distance from the pump stand to the water
 * crosses both thresholds every few minutes and the alarm status changes with it.
 */
export function createDewaterWaterLevelMonitorDemo(): DemoSimulator<typeof dewaterWaterLevelMonitorCommands> {
  let waterDistance = 14.1;
  let maxDistance = 22;
  let minDistance = 12;
  let ticks = 0;

  const alarm = (): "high" | "low" | "normal" =>
    waterDistance <= minDistance ? "high" : waterDistance >= maxDistance ? "low" : "normal";
  const reading = () => ({ water_distance: waterDistance, alarm: alarm() });

  return {
    deviceId: "DEMO-WL-0001",
    name: "MS-LEVEL Demo",
    model: "Dewater Water Level Monitor",
    intervalMs: INTERVAL_MS,
    tick() {
      ticks++;
      const target = 17 + 6.5 * Math.sin(ticks / 30);
      waterDistance = drift(waterDistance, target, 0.2, 0, 60, 1);
      return ticks === 1 ? { ...reading(), max_distance: maxDistance, min_distance: minDistance } : reading();
    },
    action() {
      return reading();
    },
    setting(name, value) {
      const distance = Number(value);
      if (!Number.isFinite(distance) || distance < 0) return { error: "Distance must be 0 ft or more.", cmd: name };
      if (name === "set_max_distance") {
        if (distance <= minDistance) return { error: "Max distance must be above the min distance.", cmd: name };
        maxDistance = distance;
        return { max_distance: distance, alarm: alarm() };
      }
      if (distance >= maxDistance) return { error: "Min distance must be below the max distance.", cmd: name };
      minDistance = distance;
      return { min_distance: distance, alarm: alarm() };
    },
  };
}
