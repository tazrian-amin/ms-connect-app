import { expect, test } from "./support/test";

// The theme button in the top bar (components/layout/theme-toggle.tsx). MUI marks the page with a
// "light" or "dark" class on <html>, and keeps the choice in localStorage ("mui-mode").

const html = (page: import("@playwright/test").Page) => page.locator("html");

test("cycles through system, light and dark, and remembers the choice", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  await page.getByRole("button", { name: "Theme: System. Switch to Light" }).click();
  await expect(html(page)).toHaveClass(/\blight\b/);

  await page.getByRole("button", { name: "Theme: Light. Switch to Dark" }).click();
  await expect(html(page)).toHaveClass(/\bdark\b/);

  await page.reload();
  await expect(html(page)).toHaveClass(/\bdark\b/);
  await expect(page.getByRole("button", { name: "Theme: Dark. Switch to System" })).toBeVisible();

  await page.getByRole("button", { name: "Theme: Dark. Switch to System" }).click();
  await expect(html(page)).toHaveClass(/\blight\b/);
});

test("on system, follows the device's setting", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Theme: System. Switch to Light" })).toBeVisible();
  await expect(html(page)).toHaveClass(/\bdark\b/);

  await page.emulateMedia({ colorScheme: "light" });
  await expect(html(page)).toHaveClass(/\blight\b/);
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the password dialog follows the theme picked in the app", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.addInitScript(() => localStorage.setItem("mui-mode", "dark"));
    await page.goto("/");
    await expect(page.getByRole("dialog", { name: "Enter the access password" })).toBeVisible();
    await expect(html(page)).toHaveClass(/\bdark\b/);
  });
});
