import { expect, test } from "./support/test";
import { ADMIN } from "./support/constants";
import { fillAdminPasswordFields, randomIp, setSitePassword, signInAsAdmin, useOwnIp } from "./support/helpers";

// Admin tests that don't change the site password. The ones that do are in admin-password.spec.ts.
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ page }) => {
  await useOwnIp(page);
});

test("the admin page asks for the admin sign-in, not the site password", async ({ page }) => {
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(401);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Username")).toBeVisible();
});

test("refuses wrong admin credentials", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel("Username").fill(ADMIN.username);
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Wrong username or password." })).toBeVisible();
});

test("blocks admin password guessing after 5 tries", async ({ request }) => {
  const headers = { "X-Forwarded-For": randomIp() };
  for (let i = 0; i < 5; i++) {
    const response = await request.post("/api/admin/session", {
      headers,
      data: { username: ADMIN.username, password: `wrong-${i}` },
    });
    expect(response.status()).toBe(401);
  }
  const blocked = await request.post("/api/admin/session", { headers, data: ADMIN });
  expect(blocked.status()).toBe(429);
});

test.describe("signed in as admin", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test("shows when the site password was last changed", async ({ page }) => {
    await expect(page.getByText(/^Last changed .* UTC\.$/)).toBeVisible();
  });

  test("rejects a password shorter than 8 characters", async ({ page }) => {
    await setSitePassword(page, "short");
    await expect(page.getByRole("alert").filter({ hasText: "Use at least 8 characters." })).toBeVisible();
  });

  test("rejects passwords that don't match", async ({ page }) => {
    await setSitePassword(page, "long-enough-1", "long-enough-2");
    await expect(page.getByRole("alert").filter({ hasText: "The two passwords don't match." })).toBeVisible();
  });

  test("keeps the button disabled until both fields are filled", async ({ page }) => {
    const button = page.getByRole("button", { name: "Change password" });
    await expect(button).toBeDisabled();
    await fillAdminPasswordFields(page, "something-long");
    await expect(button).toBeEnabled();
    await page.getByRole("textbox", { name: "Confirm new password", exact: true }).clear();
    await expect(button).toBeDisabled();
  });

  test("signs out", async ({ page }) => {
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    expect((await page.context().cookies()).some((cookie) => cookie.name === "ms_admin")).toBe(false);
  });
});
