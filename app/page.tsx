import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { DeviceCatalog } from "@/lib/homepage/device-catalog";

export default function Home() {
  return (
    <Container component="main" maxWidth="xl" sx={{ py: { xs: 3, sm: 4 }, px: { lg: 6, xl: 8 } }}>
      <Typography
        variant="h3"
        component="h1"
        sx={{
          fontWeight: 700,
          fontSize: { xs: "1.5rem", sm: "1.75rem", md: "2rem" },
          lineHeight: 1.25,
          mb: 1,
        }}
      >
        Connect Your Device
      </Typography>
      <Typography
        sx={{
          color: "text.secondary",
          fontSize: { xs: "0.875rem", sm: "1rem" },
          mb: { xs: 3, sm: 4 },
        }}
      >
        Pair Bluetooth devices, monitor live data, and manage connections.
      </Typography>

      <DeviceCatalog />
    </Container>
  );
}
