import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { ADMIN } from "./support/constants";
import { DEVICES, openDevice, startDemo } from "./support/devices";
import { useOwnIp } from "./support/helpers";
import { expect, test } from "./support/test";

/*
 * Automated WCAG 2.1 A and AA checks (axe-core) on every page, in light and dark themes. They catch
 * what a machine can (contrast, names, labels, roles, landmarks); keyboard use and screen readers
 * still need a person to try them.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function expectNoViolations(page: Page) {
  // Check the colours the page settles on, not ones caught halfway through a fade.
  await page.addStyleTag({
    content: "*, *::before, *::after { transition: none !important; animation: none !important; }",
  });
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  // One line per problem and element, so the failure says what to fix and where.
  const problems = violations.flatMap(({ id, impact, help, nodes }) =>
    nodes.map(
      ({ target, html, failureSummary }) =>
        `${impact} ${id}: ${help} → ${target.join(" ")}\n    ${html.slice(0, 200)}\n    ${failureSummary?.split("\n").slice(1).join(" ")}`,
    ),
  );
  expect(problems, "accessibility violations").toEqual([]);
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme });
    });

    test("homepage, with every device card shown", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Connect Your Device" })).toBeVisible();
      await expectNoViolations(page);

      // Each click turns a button into "Hide device details", so always click the first one left.
      const show = page.getByRole("button", { name: "Show device details" });
      for (let i = 0; i < DEVICES.length; i++) {
        await show.first().click();
        await expect(show).toHaveCount(DEVICES.length - i - 1);
      }
      await expect(page.getByRole("button", { name: "Hide device details" })).toHaveCount(DEVICES.length);
      await expectNoViolations(page);
    });

    for (const device of DEVICES) {
      test(`${device.name}, before and during a demo`, async ({ page }) => {
        await openDevice(page, device);
        await expectNoViolations(page);

        await startDemo(page);
        await expectNoViolations(page);
      });
    }

    test.describe("signed out", () => {
      test.use({ storageState: { cookies: [], origins: [] } });

      test("site password dialog", async ({ page }) => {
        await useOwnIp(page);
        await page.goto("/");
        await expect(page.getByRole("dialog", { name: "Enter the access password" })).toBeVisible();
        await expectNoViolations(page);
      });

      test("admin sign-in and access settings", async ({ page }) => {
        await useOwnIp(page);
        await page.goto("/admin");
        await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
        await expectNoViolations(page);

        await page.getByLabel("Username").fill(ADMIN.username);
        await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
        await page.getByRole("button", { name: "Sign in" }).click();
        await expect(page.getByRole("heading", { name: "Access settings" })).toBeVisible();
        await expectNoViolations(page);
      });
    });
  });
}
