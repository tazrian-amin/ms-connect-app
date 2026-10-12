import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { DeviceCatalog } from "@/lib/homepage/device-catalog";

export default function Home() {
  return (
    <Container component="main" maxWidth="xl" sx={{ py: { xs: 3, sm: 4 } }}>
      <Typography
        variant="h3"
        component="h1"
        sx={{
          fontWeight: 700,
          fontSize: { xs: "1.75rem", sm: "2.5rem", md: "3rem" },
          lineHeight: 1.2,
          mb: { xs: 1, sm: 2 },
        }}
      >
        Connect Your Device
      </Typography>
      <Typography
        sx={{
          color: "text.secondary",
          fontSize: { xs: "0.9375rem", sm: "1rem" },
          mb: { xs: 3, sm: 5 },
        }}
      >
        Pair Bluetooth devices, monitor live data, and manage connections.
      </Typography>

      <DeviceCatalog />
    </Container>
  );
}
