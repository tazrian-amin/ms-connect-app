import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ADMIN_COOKIE, readAdmin, SESSION_DAYS } from "@/lib/access/session";
import { getAccessSettings } from "@/lib/access/settings-store";
import { signOutAdmin } from "./actions";
import { SecretForm } from "./secret-form";

export const metadata: Metadata = {
  title: "Admin | MS Connect",
  robots: { index: false },
};

function lastChanged(updatedAt: number | undefined): string {
  if (!updatedAt) return "Not set yet. Nobody can get in until you set it.";
  const date = new Date(updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
  return `Last changed ${date} UTC.`;
}

// proxy.ts serves the sign-in form here until the admin signs in; this checks again regardless.
export default async function AdminPage() {
  // Rendered per request only. Without this the build would prerender the page, and reading
  // the settings at build time fails where storage is only reachable at runtime.
  await connection();
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const settings = await getAccessSettings({ fresh: true });
  if (!readAdmin(settings, token)) redirect("/admin");

  return (
    <Container component="main" maxWidth="sm" sx={{ py: { xs: 4, sm: 6 } }}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", mb: 4, gap: 2 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, fontSize: { xs: "1.5rem", sm: "2rem" } }}>
          Access settings
        </Typography>
        <form action={signOutAdmin}>
          <Button type="submit" color="inherit" variant="outlined">
            Sign out
          </Button>
        </form>
      </Stack>

      <Stack spacing={3}>
        <SecretForm
          title="Website access password"
          description={`Everyone needs this to open the site. A sign-in lasts ${SESSION_DAYS} days. Changing it signs everyone out.`}
          status={lastChanged(settings.sitePassword?.updatedAt)}
        />
      </Stack>
    </Container>
  );
}
