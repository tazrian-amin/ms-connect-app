"use client";

import { useState } from "react";
import RefreshIcon from "@mui/icons-material/Refresh";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { ActionButton, SettingForm } from "@/components/device-details/command-controls";
import { ControlSection } from "@/components/device-details/control-section";
import { DashboardSection } from "@/components/device-details/dashboard-section";
import { DashboardWidget, StatusWidget, StatWidget } from "@/components/device-details/dashboard-widgets";
import { DeviceDetailsLayout } from "@/components/device-details/device-details-layout";
import { MessageLog } from "@/components/device-details/message-log";
import { TelemetryChart } from "@/components/device-details/telemetry-chart";
import { TelemetrySection } from "@/components/device-details/telemetry-section";
import {
  dewaterPumpFloatReplacementCommands,
  pumpNumbers,
  type PumpNumber,
} from "@/lib/bluetooth/commands/dewater-pump-float-replacement";
import { useDeviceState } from "@/lib/bluetooth/hooks";
import { getMessenger } from "@/lib/bluetooth/messaging";
import { dewaterPumpFloatReplacementProfile } from "./bluetooth-profile";

const modeLabels = { normal: "Normal", alteration: "Alteration", winter: "Winter" };

// TODO: Bring-up page for testing two-way communication with the firmware. Replace with the real
// UI once the exchange is confirmed on hardware.
export function DewaterPumpFloatReplacementDetails() {
  const messenger = getMessenger(dewaterPumpFloatReplacementProfile, dewaterPumpFloatReplacementCommands);
  const { data, updatedAt } = useDeviceState(messenger);
  const [pump, setPump] = useState<PumpNumber>(1);

  return (
    <DeviceDetailsLayout
      slug="dewater-pump-float-replacement"
      controls={
        <ControlSection>
          <SettingForm
            messenger={messenger}
            setting="pump_logic_mode"
            title="Pump logic mode"
            label="Mode"
            optionLabels={modeLabels}
            reported={data.pump_logic_mode}
          />
          <SettingForm
            messenger={messenger}
            setting="set_pump_cooldown_min"
            title="Pump cooldown"
            description="How long a pump rests after it stops before it may start again."
            label="Cooldown"
            unit="min"
            min={30}
            step={1}
            reported={data.pump_cooldown_min}
          />
          <SettingForm
            messenger={messenger}
            setting="set_water_high_thr_m"
            title="High water level"
            description="At or above this level every enabled pump runs."
            label="High water"
            unit="m"
            min={0}
            max={20}
            reported={data.water_high_thr_m}
          />
          <SettingForm
            messenger={messenger}
            setting="set_water_low_thr_m"
            title="Low water level"
            description="At or below this level every pump stops with a fault."
            label="Low water"
            unit="m"
            min={0}
            max={20}
            reported={data.water_low_thr_m}
          />

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600 }}>
              Pump settings
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              color="primary"
              value={pump}
              onChange={(_, selected: PumpNumber | null) => selected !== null && setPump(selected)}
              sx={{ mt: 1, mb: 2, flexWrap: "wrap" }}
            >
              {pumpNumbers.map((number) => (
                <ToggleButton key={number} value={number} sx={{ px: 2 }}>
                  Pump {number}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Stack spacing={2}>
              <SettingForm
                key={`enable-${pump}`}
                messenger={messenger}
                setting={`pump_${pump}_set_enable`}
                title={`Pump ${pump} enabled`}
                label="Enabled"
                reported={data[`pump_${pump}_enabled`]}
              />
              <SettingForm
                key={`high-${pump}`}
                messenger={messenger}
                setting={`pump_${pump}_set_high`}
                title={`Pump ${pump} start level`}
                description="The pump starts when the water rises to this level. Must be above its stop level."
                label="Start level"
                unit="m"
                min={0}
                max={20}
                reported={data[`pump_${pump}_high_thr`]}
              />
              <SettingForm
                key={`low-${pump}`}
                messenger={messenger}
                setting={`pump_${pump}_set_low`}
                title={`Pump ${pump} stop level`}
                description="The pump stops when the water falls to this level. Must be below its start level."
                label="Stop level"
                unit="m"
                min={0}
                max={20}
                reported={data[`pump_${pump}_low_thr`]}
              />
            </Stack>
          </Paper>

          <SettingForm
            messenger={messenger}
            setting="set_current_sens_high_thr"
            title="Over-current threshold"
            label="Threshold"
            unit="ADC"
            min={0}
            max={4095}
            step={1}
            reported={data.current_high_thr}
          />
          <SettingForm
            messenger={messenger}
            setting="set_current_sens_low_thr"
            title="Under-current threshold"
            label="Threshold"
            unit="ADC"
            min={0}
            max={4095}
            step={1}
            reported={data.current_low_thr}
          />
          <SettingForm
            messenger={messenger}
            setting="ble_data_interval_s"
            title="Bluetooth data interval"
            description="How often the device sends the water level and pump start counts."
            label="Interval"
            unit="s"
            min={1}
            max={3600}
            step={1}
            reported={data.ble_data_interval_s}
          />
          <ActionButton
            messenger={messenger}
            action="reset_pump_count"
            label="Reset pump start counts"
            color="error"
            confirm="This sets every pump's current start count to zero. Total counts are kept."
          />
        </ControlSection>
      }
      dashboard={
        <DashboardSection
          updatedAt={updatedAt}
          action={
            <Stack direction="row" spacing={1}>
              <ActionButton messenger={messenger} action="get_status" label="Device info" requiresEditMode={false} />
              <ActionButton
                messenger={messenger}
                action="get_pump_states"
                label="Refresh"
                icon={<RefreshIcon />}
                requiresEditMode={false}
              />
            </Stack>
          }
        >
          <StatWidget label="Water level" value={data.current_water_level} unit="m" precision={2} />
          <StatusWidget
            label="Mode"
            status={data.pump_logic_mode ? { text: modeLabels[data.pump_logic_mode], color: "primary" } : null}
          />
          <StatWidget label="Pump cooldown" value={data.pump_cooldown_min} unit="min" precision={0} />
          <DashboardWidget label="Device">
            <Typography variant="body2">
              {data.embedded_software_ver
                ? `Firmware ${data.embedded_software_ver} · Serial ${data.serial_number ?? "—"}`
                : "Press Device info."}
            </Typography>
          </DashboardWidget>
          {pumpNumbers.map((number) => {
            const enabled = data[`pump_${number}_enabled`];
            return (
              <DashboardWidget key={number} label={`Pump ${number}`}>
                <Typography variant="h6" component="p" sx={{ fontWeight: 600 }}>
                  {data[`pump_${number}_fault`]
                    ? "Fault"
                    : enabled === undefined
                      ? "—"
                      : enabled
                        ? "Enabled"
                        : "Disabled"}
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Starts {data[`pump_${number}_current_starts`] ?? "—"} · total{" "}
                  {data[`pump_${number}_total_starts`] ?? "—"}
                </Typography>
              </DashboardWidget>
            );
          })}
        </DashboardSection>
      }
      telemetry={
        <TelemetrySection>
          <TelemetryChart title="Water level" unit="m" />
          <TelemetryChart title="Pump activity" />
        </TelemetrySection>
      }
      diagnostics={<MessageLog messenger={messenger} />}
    />
  );
}
