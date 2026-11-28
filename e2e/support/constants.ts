import path from "node:path";

/** Admin credentials the test server is started with (see playwright.config.ts). Test-only values. */
export const ADMIN = { username: "e2e-admin", password: "e2e-admin-password" };

/** The site password the setup project sets. */
export const SITE_PASSWORD = "e2e-site-password";

/** Where the signed-in visitor's cookies and storage are saved for the other tests. */
export const AUTH_FILE = path.join(__dirname, "..", ".auth", "visitor.json");
