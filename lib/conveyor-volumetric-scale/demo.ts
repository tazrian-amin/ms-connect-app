import { conveyorVolumetricScaleCommands } from "@/lib/bluetooth/commands/conveyor-volumetric-scale";
import { drift, type DemoSimulator } from "@/lib/bluetooth/demo";

const INTERVAL_MS = 2_000;

/** A belt carrying a steady load that varies a little, adding to the total volume as it runs. */
export function createConveyorVolumetricScaleDemo(): DemoSimulator<typeof conveyorVolumetricScaleCommands> {
  let beltSpeed = 2.4;
  let volumeRate = 118;
  let totalVolume = 4_826.3;
  const productionGoal = 6_000;

  const reading = () => ({
    volume_rate: volumeRate,
    total_volume: totalVolume,
    belt_speed: beltSpeed,
    production_goal: productionGoal,
  });

  return {
    deviceId: "DEMO-CVS-0001",
    name: "MS-CVS Demo",
    model: "Conveyor Volumetric Scale",
    intervalMs: INTERVAL_MS,
    tick() {
      beltSpeed = drift(beltSpeed, 2.4, 0.08, 2, 2.8, 2);
      volumeRate = drift(volumeRate, 120 * (beltSpeed / 2.4), 8, 80, 160);
      totalVolume = Math.round((totalVolume + (volumeRate * INTERVAL_MS) / 3_600_000) * 1_000) / 1_000;
      return reading();
    },
    action(name) {
      if (name === "reset_total") totalVolume = 0;
      return name === "reset_total" ? { total_volume: totalVolume } : reading();
    },
    setting(name) {
      return { error: `Unknown setting ${name}.`, cmd: name };
    },
  };
}
