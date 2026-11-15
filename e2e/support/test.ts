import { test as base, expect } from "@playwright/test";

/*
 * The `test` every spec uses. On top of Playwright's own, it:
 *
 * - blocks requests to other sites (map tiles, place names from OpenStreetMap), so tests never
 *   depend on outside services or load them. A spec that fakes one (see tracker-api.ts) routes it
 *   itself; routes added later take precedence over this one.
 * - fails the test on an uncaught error in the page, unless the test opts out with
 *   `test.use({ allowPageErrors: true })`.
 */
type Options = { allowPageErrors: boolean };
type Fixtures = { pageErrors: string[] };

export const test = base.extend<Options & Fixtures>({
  allowPageErrors: [false, { option: true }],

  context: async ({ context, baseURL }, use) => {
    const ownOrigin = new URL(baseURL!).origin;
    await context.route(
      (url) => url.origin !== ownOrigin,
      (route) => route.abort("blockedbyclient"),
    );
    await use(context);
  },

  pageErrors: [
    async ({ page, allowPageErrors }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await use(errors);
      if (!allowPageErrors) expect(errors, "uncaught errors in the page").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
