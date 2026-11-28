import { expect, test as setup } from "@playwright/test";
import { AUTH_FILE, SITE_PASSWORD } from "./support/constants";
import { setSitePassword, signInAsAdmin, submitSitePassword, useOwnIp } from "./support/helpers";

// The test server starts with no site password, so nobody can get in until the admin sets one.
setup("admin sets the site password and a visitor signs in", async ({ page }) => {
  await useOwnIp(page);

  await signInAsAdmin(page);
  await expect(page.getByText("Not set yet. Nobody can get in until you set it.")).toBeVisible();
  await setSitePassword(page, SITE_PASSWORD);
  await expect(page.getByText("Password changed. Everyone has been signed out.")).toBeVisible();

  // The other tests run as a plain visitor, not as the admin.
  await page.context().clearCookies({ name: "ms_admin" });

  // The sign-in route keeps its own copy of the settings for up to 5 s (CACHE_TTL_MS in
  // lib/access/settings-store.ts), so the new password may not be accepted straight away.
  await page.goto("/");
  await expect(async () => {
    await submitSitePassword(page, SITE_PASSWORD);
    await expect(page.getByRole("heading", { name: "Connect Your Device" })).toBeVisible({ timeout: 1_000 });
  }).toPass({ intervals: [1_000, 2_000, 2_000], timeout: 15_000 });

  await page.context().storageState({ path: AUTH_FILE });
});
