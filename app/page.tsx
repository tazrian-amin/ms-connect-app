import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { DeviceCatalog } from "@/lib/homepage/device-catalog";

export default function Home() {
  return (
    <Container component="main" maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" sx={{ fontWeight: 700, mb: 2 }}>
        Connect Your Device
      </Typography>
      <Typography sx={{ color: "text.secondary", mb: 5 }}>
        Pair Bluetooth devices, monitor live data, and manage connections.
      </Typography>

      <DeviceCatalog />
    </Container>
  );
}
