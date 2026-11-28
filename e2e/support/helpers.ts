import { expect, type Page } from "@playwright/test";
import { ADMIN } from "./constants";

/**
 * Sign-in is rate limited per client IP (lib/access/session.ts reads X-Forwarded-For). Giving each
 * test its own address keeps tests that try wrong passwords from locking each other out.
 */
export async function useOwnIp(page: Page): Promise<string> {
  const ip = randomIp();
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": ip });
  return ip;
}

/** A random private address, for requests that need their own rate limit. */
export function randomIp(): string {
  const n = () => Math.floor(Math.random() * 254) + 1;
  return `10.${n()}.${n()}.${n()}`;
}

/** Fills in and submits the site password dialog (lib/access/gate-pages.ts). */
export async function submitSitePassword(page: Page, password: string) {
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
}

/** Signs in on the admin sign-in page and waits for the access settings page. */
export async function signInAsAdmin(page: Page, credentials = ADMIN) {
  await page.goto("/admin");
  await page.getByLabel("Username").fill(credentials.username);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Access settings" })).toBeVisible();
}

/** Sets the site password from the admin's access settings page. */
export async function setSitePassword(page: Page, password: string, confirm = password) {
  await fillAdminPasswordFields(page, password, confirm);
  await page.getByRole("button", { name: "Change password" }).click();
}

/**
 * Fills both fields of the admin's password form. The page is rendered per request, so it can
 * still be hydrating when the fields appear; React then resets what was typed. Fills again until
 * the form has taken the values (its button enables once both fields are filled).
 */
export async function fillAdminPasswordFields(page: Page, password: string, confirm = password) {
  await expect(async () => {
    await page.getByRole("textbox", { name: "New password", exact: true }).fill(password);
    await page.getByRole("textbox", { name: "Confirm new password", exact: true }).fill(confirm);
    await expect(page.getByRole("button", { name: "Change password" })).toBeEnabled({ timeout: 500 });
  }).toPass({ timeout: 10_000 });
}
