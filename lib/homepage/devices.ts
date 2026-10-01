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
  /** URL segment for the details page: /devices/{slug}. Matches the lib/{slug} folder. */
  slug: string;
  name: string;
  emoji: string;
  description: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export const devices: Device[] = [
  {
    slug: "discharge-water-flow-monitor",
    name: "Discharge Water Flow Monitor",
    emoji: "💧",
    description: "Measure discharge flow rate and total volume on dewatering lines.",
    Icon: FlowMonitorIcon,
  },
  {
    slug: "dewater-water-level-monitor",
    name: "Dewater Water Level Monitor",
    emoji: "🌊",
    description: "Track sump and pit water levels in real time.",
    Icon: WaterLevelIcon,
  },
  {
    slug: "dewater-pump-float-replacement",
    name: "Dewater Pump Float Replacement",
    emoji: "🛟",
    description: "Wireless level switching to replace mechanical pump floats.",
    Icon: PumpFloatIcon,
  },
  {
    slug: "conveyor-volumetric-scale",
    name: "Conveyor Volumetric Scale",
    emoji: "📦",
    description: "Estimate material volume and throughput on conveyor belts.",
    Icon: ConveyorScaleIcon,
  },
  {
    slug: "conveyor-volumetric-scale-pro",
    name: "Conveyor Volumetric Scale Pro",
    emoji: "📸",
    description: "Camera-assisted volumetric measurement for higher accuracy.",
    Icon: ConveyorScaleProIcon,
  },
  {
    slug: "bin-height-measurement",
    name: "Bin Height Measurement",
    emoji: "📏",
    description: "Monitor the fill height of bins, hoppers and silos.",
    Icon: BinHeightIcon,
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
