import { expect, test } from "./support/test";
import { SITE_PASSWORD } from "./support/constants";
import { randomIp, submitSitePassword, useOwnIp } from "./support/helpers";

// These tests start signed out.
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ page }) => {
  await useOwnIp(page);
});

test.describe("site password gate", () => {
  for (const path of ["/", "/devices/asset-tracker"]) {
    test(`shows the password dialog instead of ${path}`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(401);
      await expect(page.getByRole("dialog", { name: "Enter the access password" })).toBeVisible();
      // None of the app is served before signing in.
      await expect(page.getByRole("heading", { name: "Connect Your Device" })).toHaveCount(0);
    });
  }

  test("refuses a wrong password and says so", async ({ page }) => {
    await page.goto("/");
    await submitSitePassword(page, "not-the-password");
    await expect(page.getByRole("alert")).toHaveText("That password isn't right.");
    await expect(page.getByRole("dialog", { name: "Enter the access password" })).toBeVisible();
  });

  test("signs in with the right password and stays on the page that was opened", async ({ page }) => {
    await page.goto("/devices/discharge-water-flow-monitor");
    await submitSitePassword(page, SITE_PASSWORD);
    await expect(page.getByRole("heading", { level: 1, name: "Discharge Water Flow Monitor" })).toBeVisible();
    await expect(page).toHaveURL(/\/devices\/discharge-water-flow-monitor$/);
  });

  test("the eye button shows and hides the password", async ({ page }) => {
    await page.goto("/");
    const input = page.getByLabel("Password", { exact: true });
    await input.fill("secret");
    await expect(input).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "Show password" }).click();
    await expect(input).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(input).toHaveAttribute("type", "password");
  });

  test("refuses the app's data and scripts without a session", async ({ request }) => {
    const session = await request.get("/api/session");
    expect(session.status()).toBe(401);
    expect(await session.json()).toMatchObject({ authenticated: false, pages: [] });

    // Not a page load (no text/html Accept header), so a bare 401 rather than the dialog.
    const data = await request.get("/devices/asset-tracker", { headers: { Accept: "*/*", RSC: "1" } });
    expect(data.status()).toBe(401);
    expect(await data.text()).toBe("Unauthorized");
  });

  test("blocks password guessing after 10 tries", async ({ request }) => {
    const headers = { "X-Forwarded-For": randomIp() };
    for (let i = 0; i < 10; i++) {
      const response = await request.post("/api/session", { headers, data: { password: `wrong-${i}` } });
      expect(response.status()).toBe(401);
    }
    // Even the right password is refused while blocked.
    const blocked = await request.post("/api/session", { headers, data: { password: SITE_PASSWORD } });
    expect(blocked.status()).toBe(429);
  });
});

test("a signed-in visitor's session is reported by /api/session", async ({ browser }) => {
  // Uses the session the setup project saved.
  const context = await browser.newContext({ storageState: "e2e/.auth/visitor.json" });
  const response = await context.request.get("/api/session");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.authenticated).toBe(true);
  expect(body.pages).toContain("/");
  expect(body.pages).toContain("/devices/asset-tracker");
  await context.close();
});
