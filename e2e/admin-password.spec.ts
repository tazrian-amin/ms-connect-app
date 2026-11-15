import { expect, test } from "./support/test";
import { AUTH_FILE, SITE_PASSWORD } from "./support/constants";
import { setSitePassword, signInAsAdmin, submitSitePassword, useOwnIp } from "./support/helpers";

/*
 * Changing the site password signs everyone out, including the session every other test uses.
 * So these run in the "admin" project, after all the others (see playwright.config.ts).
 */
test.describe.configure({ mode: "serial" });

const NEW_PASSWORD = "e2e-changed-password";

test("changing the site password signs out existing visitors and only the new one works", async ({ browser }) => {
  const admin = await browser.newPage();
  await useOwnIp(admin);
  await signInAsAdmin(admin);
  await setSitePassword(admin, NEW_PASSWORD);
  await expect(admin.getByText("Password changed. Everyone has been signed out.")).toBeVisible();
  await admin.close();

  // A visitor who signed in with the old password. Allows for the settings cache (up to 5 s).
  const visitor = await browser.newContext({ storageState: AUTH_FILE });
  const page = await visitor.newPage();
  await useOwnIp(page);
  await expect(async () => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(401);
  }).toPass({ intervals: [1_000, 2_000, 2_000], timeout: 15_000 });
  await expect(page.getByRole("dialog", { name: "Enter the access password" })).toBeVisible();

  await submitSitePassword(page, SITE_PASSWORD);
  await expect(page.getByRole("alert")).toHaveText("That password isn't right.");

  await submitSitePassword(page, NEW_PASSWORD);
  await expect(page.getByRole("heading", { name: "Connect Your Device" })).toBeVisible();
  await visitor.close();
});
