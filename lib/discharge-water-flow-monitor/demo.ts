import { dischargeWaterFlowMonitorCommands } from "@/lib/bluetooth/commands/discharge-water-flow-monitor";
import { drift, type DemoSimulator } from "@/lib/bluetooth/demo";

const INTERVAL_MS = 2_000;

/** A discharge line whose flow surges and settles, adding to the total volume as it runs. */
export function createDischargeWaterFlowMonitorDemo(): DemoSimulator<typeof dischargeWaterFlowMonitorCommands> {
  let flowRate = 340;
  let totalVolume = 1_284_650;
  let ticks = 0;

  const reading = () => ({ flow_rate: flowRate, total_volume: Math.round(totalVolume) });

  return {
    deviceId: "DEMO-FM-0001",
    name: "MS-FLOW Demo",
    model: "Discharge Water Flow Monitor",
    intervalMs: INTERVAL_MS,
    tick() {
      ticks++;
      // A slow swell every few minutes, as pumps upstream cycle.
      const target = 340 + 90 * Math.sin(ticks / 25);
      flowRate = drift(flowRate, target, 14, 0, 600);
      totalVolume += (flowRate * INTERVAL_MS) / 60_000;
      return reading();
    },
    action(name) {
      if (name === "reset_total") {
        totalVolume = 0;
        return { total_volume: 0 };
      }
      return reading();
    },
    setting(name) {
      return { error: `Unknown setting ${name}.`, cmd: name };
    },
  };
}
