import { binHeightMeasurementCommands } from "./bin-height-measurement";
import { conveyorVolumetricScaleCommands } from "./conveyor-volumetric-scale";
import { conveyorVolumetricScaleProCommands } from "./conveyor-volumetric-scale-pro";
import { dewaterPumpFloatReplacementCommands } from "./dewater-pump-float-replacement";
import { dewaterWaterLevelMonitorCommands } from "./dewater-water-level-monitor";
import { dischargeWaterFlowMonitorCommands } from "./discharge-water-flow-monitor";
import type { CommandSet } from "./schema";

/** Command set for each device slug. Device-specific code should import its own set for exact types. */
export const deviceCommands: Record<string, CommandSet> = {
  "discharge-water-flow-monitor": dischargeWaterFlowMonitorCommands,
  "dewater-water-level-monitor": dewaterWaterLevelMonitorCommands,
  "dewater-pump-float-replacement": dewaterPumpFloatReplacementCommands,
  "conveyor-volumetric-scale": conveyorVolumetricScaleCommands,
  "conveyor-volumetric-scale-pro": conveyorVolumetricScaleProCommands,
  "bin-height-measurement": binHeightMeasurementCommands,
};
