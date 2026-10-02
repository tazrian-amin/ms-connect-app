import type { ReactNode } from "react";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

type DeviceSectionProps = {
  title: string;
  description?: ReactNode;
  /** Shown at the right of the header, e.g. a button. */
  action?: ReactNode;
  children?: ReactNode;
};

/** Card with a heading that every section of a device details page is built on. */
export function DeviceSection({ title, description, action, children }: DeviceSectionProps) {
  return (
    <Card component="section" variant="outlined" sx={{ borderRadius: 2, p: 2.5 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between" }}
      >
        <Stack spacing={0.75} sx={{ minWidth: 0 }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          {description && (
            <Typography variant="body2" component="div" sx={{ color: "text.secondary" }}>
              {description}
            </Typography>
          )}
        </Stack>
        {action}
      </Stack>
      {children}
    </Card>
  );
}
