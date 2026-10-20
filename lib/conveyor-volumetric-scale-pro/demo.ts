import { conveyorVolumetricScaleProCommands } from "@/lib/bluetooth/commands/conveyor-volumetric-scale-pro";
import { drift, type DemoSimulator } from "@/lib/bluetooth/demo";

const INTERVAL_MS = 2_000;

/**
 * A belt carrying a load that varies a little. Mass rate follows from volume rate and the material
 * density, so changing the density setting changes the mass rate straight away.
 */
export function createConveyorVolumetricScaleProDemo(): DemoSimulator<typeof conveyorVolumetricScaleProCommands> {
  let beltSpeed = 2.6;
  let volumeRate = 132;
  let totalVolume = 9_412.8;
  let materialDensity = 1.6;
  let ticks = 0;

  const massRate = () => Math.round(volumeRate * materialDensity * 10) / 10;
  const reading = () => ({
    volume_rate: volumeRate,
    total_volume: totalVolume,
    mass_rate: massRate(),
    belt_speed: beltSpeed,
  });

  return {
    deviceId: "DEMO-CVSP-0001",
    name: "MS-CVSP Demo",
    model: "Conveyor Volumetric Scale Pro",
    intervalMs: INTERVAL_MS,
    tick() {
      ticks++;
      beltSpeed = drift(beltSpeed, 2.6, 0.08, 2.2, 3, 2);
      volumeRate = drift(volumeRate, 130 * (beltSpeed / 2.6), 9, 90, 180);
      totalVolume = Math.round((totalVolume + (volumeRate * INTERVAL_MS) / 3_600_000) * 1_000) / 1_000;
      return ticks === 1 ? { ...reading(), material_density: materialDensity } : reading();
    },
    action(name) {
      if (name === "reset_total") {
        totalVolume = 0;
        return { total_volume: 0 };
      }
      return reading();
    },
    setting(name, value) {
      const density = Number(value);
      if (!Number.isFinite(density) || density <= 0) return { error: "Density must be above 0.", cmd: name };
      materialDensity = density;
      return { material_density: density, mass_rate: massRate() };
    },
  };
}
