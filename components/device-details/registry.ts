import type { ComponentType } from "react";
import { BinHeightMeasurementDetails } from "@/lib/bin-height-measurement/device-details";
import { ConveyorVolumetricScaleDetails } from "@/lib/conveyor-volumetric-scale/device-details";
import { ConveyorVolumetricScaleProDetails } from "@/lib/conveyor-volumetric-scale-pro/device-details";
import { DewaterPumpFloatReplacementDetails } from "@/lib/dewater-pump-float-replacement/device-details";
import { DewaterWaterLevelMonitorDetails } from "@/lib/dewater-water-level-monitor/device-details";
import { DischargeWaterFlowMonitorDetails } from "@/lib/discharge-water-flow-monitor/device-details";

/** Details page content for each device slug. Each one composes `DeviceDetailsLayout` and its four sections. */
export const deviceDetails: Record<string, ComponentType> = {
  "discharge-water-flow-monitor": DischargeWaterFlowMonitorDetails,
  "dewater-water-level-monitor": DewaterWaterLevelMonitorDetails,
  "dewater-pump-float-replacement": DewaterPumpFloatReplacementDetails,
  "conveyor-volumetric-scale": ConveyorVolumetricScaleDetails,
  "conveyor-volumetric-scale-pro": ConveyorVolumetricScaleProDetails,
  "bin-height-measurement": BinHeightMeasurementDetails,
};
