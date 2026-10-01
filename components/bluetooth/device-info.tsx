"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { decodeText } from "@/lib/bluetooth/codec";
import type { BluetoothConnection } from "@/lib/bluetooth/connection";
import type { StandardCharacteristic } from "@/lib/bluetooth/profile";

const fields: { key: StandardCharacteristic; label: string; format: (value: DataView) => string }[] = [
  { key: "manufacturer", label: "Manufacturer", format: decodeText },
  { key: "model", label: "Model", format: decodeText },
  { key: "firmware", label: "Firmware", format: decodeText },
  { key: "battery", label: "Battery", format: (value) => `${value.getUint8(0)}%` },
];

/** Reads the standard device-information and battery characteristics once after connecting. */
export function DeviceInfo({ connection }: { connection: BluetoothConnection<StandardCharacteristic> }) {
  const [values, setValues] = useState<Partial<Record<StandardCharacteristic, string>>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const { key, format } of fields) {
        try {
          const text = format(await connection.read(key));
          if (!cancelled) setValues((previous) => ({ ...previous, [key]: text }));
        } catch {
          // The device does not expose this characteristic; leave it out.
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connection]);

  const shown = fields.filter(({ key }) => values[key] !== undefined);
  if (shown.length === 0) return null;

  return (
    <Box
      component="dl"
      sx={{ display: "grid", gridTemplateColumns: "max-content 1fr", columnGap: 3, rowGap: 0.5, mt: 2, mb: 0 }}
    >
      {shown.map(({ key, label }) => (
        <Box key={key} sx={{ display: "contents" }}>
          <Typography component="dt" variant="body2" sx={{ color: "text.secondary" }}>
            {label}
          </Typography>
          <Typography component="dd" variant="body2" sx={{ m: 0 }}>
            {values[key]}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
