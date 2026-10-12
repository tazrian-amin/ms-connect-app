import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { deviceDetails } from "@/components/device-details/registry";
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
  const Details = deviceDetails[slug];

  return (
    <Container component="main" maxWidth="xl" sx={{ py: { xs: 3, sm: 4 } }}>
      <BackButton href="/">All devices</BackButton>

      <Stack
        direction="row"
        spacing={{ xs: 1.5, sm: 2.5 }}
        sx={{ alignItems: "center", mb: { xs: 1.5, sm: 2 } }}
      >
        <DeviceIconTile Icon={device.Icon} size={{ xs: 52, sm: 72 }} />
        <Typography
          variant="h4"
          component="h1"
          sx={{ fontWeight: 700, fontSize: { xs: "1.375rem", sm: "1.75rem", md: "2.125rem" }, lineHeight: 1.25 }}
        >
          {device.name}
        </Typography>
      </Stack>
      <Typography
        sx={{ color: "text.secondary", fontSize: { xs: "0.9375rem", sm: "1rem" }, mb: { xs: 3, sm: 4 } }}
      >
        {device.description}
      </Typography>

      <Details />
    </Container>
  );
}
