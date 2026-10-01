import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { appVersion, buildId } from "@/lib/app-version";

// Server component, so only the version strings reach the client bundle. Support can ask
// users to read this out to confirm their installed app is on the latest deploy.
export function Footer() {
  return (
    <Box
      component="footer"
      sx={{
        mt: "auto",
        py: 2,
        px: 2,
        textAlign: "center",
        bgcolor: "background.paper",
        borderTop: 1,
        borderColor: "divider",
      }}
    >
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        Version {appVersion} (build {buildId})
      </Typography>
    </Box>
  );
}
