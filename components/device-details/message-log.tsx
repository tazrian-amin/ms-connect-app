"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import type { CommandSet } from "@/lib/bluetooth/commands/schema";
import type { DeviceMessenger, TrafficEntry } from "@/lib/bluetooth/messaging";
import { DeviceSection } from "./device-section";

const MAX_ENTRIES = 200;

/**
 * Every line sent to and received from the device, newest first, including lines the app ignored
 * and why. For bringing up new firmware; works on a phone where there is no developer console.
 */
export function MessageLog<C extends CommandSet>({ messenger }: { messenger: DeviceMessenger<C> }) {
  const [entries, setEntries] = useState<TrafficEntry[]>([]);

  useEffect(
    () => messenger.subscribeTraffic((entry) => setEntries((previous) => [entry, ...previous].slice(0, MAX_ENTRIES))),
    [messenger],
  );

  return (
    <DeviceSection
      title="Message log"
      description="Raw lines exchanged with the device while this page is open."
      action={
        <Button variant="outlined" disabled={entries.length === 0} onClick={() => setEntries([])}>
          Clear
        </Button>
      }
    >
      <Box
        sx={{
          mt: 2,
          maxHeight: 360,
          overflow: "auto",
          fontFamily: "monospace",
          fontSize: 12,
          bgcolor: "action.hover",
          borderRadius: 1,
          p: 1.5,
        }}
      >
        {entries.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Nothing yet. Connect, then send a command or wait for the device&apos;s periodic data.
          </Typography>
        ) : (
          entries.map((entry, index) => (
            <Box key={entries.length - index} sx={{ py: 0.25, overflowWrap: "anywhere" }}>
              <Box component="span" sx={{ color: "text.secondary" }}>
                {new Date(entry.time).toLocaleTimeString()} {entry.direction === "out" ? "→" : "←"}{" "}
              </Box>
              <Box component="span" sx={{ color: entry.problem ? "warning.main" : "text.primary" }}>
                {entry.line}
              </Box>
              {entry.problem && (
                <Box component="span" sx={{ color: "warning.main", display: "block", pl: 2 }}>
                  ignored: {entry.problem}
                </Box>
              )}
            </Box>
          ))
        )}
      </Box>
    </DeviceSection>
  );
}
