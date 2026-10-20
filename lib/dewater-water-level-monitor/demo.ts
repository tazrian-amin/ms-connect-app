import { dewaterWaterLevelMonitorCommands } from "@/lib/bluetooth/commands/dewater-water-level-monitor";
import { drift, type DemoSimulator } from "@/lib/bluetooth/demo";

const INTERVAL_MS = 2_000;

/**
 * A sump that slowly fills and is pumped down again, so the level crosses the alarm levels every
 * few minutes and the alarm status changes with it.
 */
export function createDewaterWaterLevelMonitorDemo(): DemoSimulator<typeof dewaterWaterLevelMonitorCommands> {
  let waterLevel = 2.6;
  let highAlarmLevel = 4.2;
  let lowAlarmLevel = 1.2;
  let ticks = 0;

  const alarm = (): "high" | "low" | "normal" =>
    waterLevel >= highAlarmLevel ? "high" : waterLevel <= lowAlarmLevel ? "low" : "normal";
  const reading = () => ({ water_level: waterLevel, alarm: alarm() });

  return {
    deviceId: "DEMO-WL-0001",
    name: "MS-LEVEL Demo",
    model: "Dewater Water Level Monitor",
    intervalMs: INTERVAL_MS,
    tick() {
      ticks++;
      const target = 2.7 + 1.9 * Math.sin(ticks / 30);
      waterLevel = drift(waterLevel, target, 0.06, 0, 6, 2);
      return ticks === 1
        ? { ...reading(), high_alarm_level: highAlarmLevel, low_alarm_level: lowAlarmLevel }
        : reading();
    },
    action() {
      return reading();
    },
    setting(name, value) {
      const level = Number(value);
      if (!Number.isFinite(level) || level < 0) return { error: "Level must be 0 m or more.", cmd: name };
      if (name === "set_high_alarm_level") {
        if (level <= lowAlarmLevel) return { error: "High level must be above the low level.", cmd: name };
        highAlarmLevel = level;
        return { high_alarm_level: level, alarm: alarm() };
      }
      if (level >= highAlarmLevel) return { error: "Low level must be below the high level.", cmd: name };
      lowAlarmLevel = level;
      return { low_alarm_level: level, alarm: alarm() };
    },
  };
}
