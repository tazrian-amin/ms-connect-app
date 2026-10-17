import type { ComponentType, SVGProps } from "react";
import {
  BinHeightIcon,
  ConveyorScaleIcon,
  ConveyorScaleProIcon,
  FlowMonitorIcon,
  PumpFloatIcon,
  WaterLevelIcon,
} from "./device-icons";

export type Device = {
  /** URL segment for the details page: /devices/{slug}. */
  slug: string;
  name: string;
  description: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export const devices: Device[] = [
  {
    slug: "dewater-pump-float-replacement",
    name: "Dewater Pump Float Replacement",
    description: "Controls up to 6 pumps based on both the current water height and user set high and low levels for each pump control relay. Eliminates the maintenance needs of floats.",
    Icon: PumpFloatIcon,
  },
  {
    slug: "bin-height-measurement",
    name: "Bin Height Measurement",
    description: "Measures the height of material in bins and provides real-time data for inventory management.",
    Icon: BinHeightIcon,
  },
  {
    slug: "conveyor-volumetric-scale",
    name: "Conveyor Volumetric Scale",
    description: "Reports the instantaneous and aggregated production volume.",
    Icon: ConveyorScaleIcon,
  },
  {
    slug: "conveyor-volumetric-scale-pro",
    name: "Conveyor Volumetric Scale Pro",
    description: "Reports the instantaneous and aggregated production volume. Camera-assisted volumetric measurement for higher accuracy.",
    Icon: ConveyorScaleProIcon,
  },
  {
    slug: "discharge-water-flow-monitor",
    name: "Discharge Water Flow Monitor",
    description: "Monitors water flow in discharge systems and provides real-time data for analysis and alerts.",
    Icon: FlowMonitorIcon,
  },
  {
    slug: "dewater-water-level-monitor",
    name: "Dewater Water Level Monitor",
    description: "Reports Instantaneous Water Level; Sends Alerts When Outside User Settable High & Low Levels.",
    Icon: WaterLevelIcon,
  },
];

export function getDevice(slug: string): Device | undefined {
  return devices.find((device) => device.slug === slug);
}

export function filterDevices(query: string): Device[] {
  const q = query.trim().toLowerCase();
  if (!q) return devices;
  return devices.filter(
    (device) =>
      device.name.toLowerCase().includes(q) ||
      device.description.toLowerCase().includes(q),
  );
}
