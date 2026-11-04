"use client";

import { useState } from "react";
import { disableViewMode, useViewMode } from "@/lib/access/session-client";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { DeviceCard } from "./device-card";
import { DeviceSearch } from "./device-search";
import { devices, filterDevices } from "./devices";
import { ViewCodeDialog } from "./view-code-dialog";

export function DeviceCatalog() {
  const [query, setQuery] = useState("");
  const [askingForCode, setAskingForCode] = useState(false);
  const viewMode = useViewMode();
  // Searching hidden devices would reveal their names, so all show until view mode is on.
  const results = viewMode ? filterDevices(query) : devices;
  const toggleView = () => (viewMode ? disableViewMode() : setAskingForCode(true));

  return (
    <Stack component="section" aria-labelledby="device-categories" spacing={{ xs: 2, sm: 3 }}>
      <Typography
        id="device-categories"
        variant="h5"
        component="h2"
        sx={{ fontWeight: 500, fontSize: { xs: "1.125rem", sm: "1.25rem" } }}
      >
        Device Categories
      </Typography>

      <DeviceSearch value={viewMode ? query : ""} onChange={setQuery} disabled={!viewMode} />

      {results.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gap: { xs: 1.5, sm: 2 },
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
          }}
        >
          {results.map((device) => (
            <DeviceCard key={device.slug} device={device} revealed={viewMode} onToggleView={toggleView} />
          ))}
        </Box>
      ) : (
        <Typography sx={{ color: "text.secondary", py: 4, textAlign: "center" }}>
          No devices match &ldquo;{query.trim()}&rdquo;.
        </Typography>
      )}

      <ViewCodeDialog open={askingForCode} onClose={() => setAskingForCode(false)} />
    </Stack>
  );
}
