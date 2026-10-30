import { dischargeWaterFlowMonitorCommands } from "@/lib/bluetooth/commands/discharge-water-flow-monitor";
import { drift, type DemoSimulator } from "@/lib/bluetooth/demo";

const INTERVAL_MS = 2_000;

/**
 * A discharge line whose flow surges and settles, adding to the total volume as it runs. The sensor's
 * 0–10 V output is simulated, so changing the scaling changes the reported flow as it would on the device.
 */
export function createDischargeWaterFlowMonitorDemo(): DemoSimulator<typeof dischargeWaterFlowMonitorCommands> {
  let volts = 5;
  let flowPerVolt = 50;
  let totalVolume = 339_380;
  let ticks = 0;

  const flowRate = () => Math.round(volts * flowPerVolt * 10) / 10;
  const reading = () => ({ flow_rate: flowRate(), total_volume: Math.round(totalVolume), flow_per_volt: flowPerVolt });

  return {
    deviceId: "DEMO-FM-0001",
    name: "MS-FLOW Demo",
    model: "Discharge Water Flow Monitor",
    intervalMs: INTERVAL_MS,
    tick() {
      ticks++;
      // A slow swell every few minutes, as pumps upstream cycle.
      const target = 5 + 1.4 * Math.sin(ticks / 25);
      volts = drift(volts, target, 0.2, 0, 10, 2);
      totalVolume += (flowRate() * INTERVAL_MS) / 60_000;
      return reading();
    },
    action(name) {
      if (name === "reset_total") {
        totalVolume = 0;
        return { total_volume: 0 };
      }
      return reading();
    },
    setting(name, value) {
      const scale = Number(value);
      if (!Number.isFinite(scale) || scale <= 0) return { error: "Flow per volt must be above 0.", cmd: name };
      flowPerVolt = scale;
      return { flow_per_volt: scale, flow_rate: flowRate() };
    },
  };
}
