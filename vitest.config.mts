import path from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests for the app's logic, next to the code as *.test.ts. The browser tests are in e2e/
// and run with Playwright instead.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
      // Next.js makes this throw outside the server; here it just marks server code.
      "server-only": path.resolve(import.meta.dirname, "test/server-only.ts"),
    },
  },
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    environment: "node",
    setupFiles: ["test/setup.ts"],
    restoreMocks: true,
    unstubEnvs: true,
  },
});
