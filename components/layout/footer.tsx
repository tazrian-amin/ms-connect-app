import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import packageJson from "@/package.json";

// Server component, so only the version string reaches the client bundle.
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
        Version {packageJson.version}
      </Typography>
    </Box>
  );
}
