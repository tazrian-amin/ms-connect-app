import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { BackButton } from "@/components/ui/back-button";
import { DeviceIconTile } from "@/lib/homepage/device-icon-tile";
import { devices, getDevice } from "@/lib/homepage/devices";

// Only the known devices exist; any other slug is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return devices.map(({ slug }) => ({ slug }));
}

export async function generateMetadata(props: PageProps<"/devices/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const device = getDevice(slug);
  return device ? { title: `${device.name} | MS Connect`, description: device.description } : {};
}

export default async function DevicePage(props: PageProps<"/devices/[slug]">) {
  const { slug } = await props.params;
  const device = getDevice(slug);
  if (!device) notFound();

  return (
    <Container component="main" maxWidth="lg" sx={{ py: 4 }}>
      <BackButton href="/">All devices</BackButton>

      <Stack direction="row" spacing={2.5} sx={{ alignItems: "center", mb: 2 }}>
        <DeviceIconTile Icon={device.Icon} size={72} />
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          {device.name}
        </Typography>
      </Stack>
      <Typography sx={{ color: "text.secondary" }}>{device.description}</Typography>
    </Container>
  );
}
