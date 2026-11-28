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
    // `npm run test:coverage`. Counts the logic in lib/*.ts; components (.tsx) are covered by e2e/.
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts"],
      exclude: ["lib/**/*.test.ts", "lib/**/*.d.ts"],
      reporter: ["text-summary", "html"],
      // A floor just under the current coverage, so it can only go up. Raise it as tests are added.
      thresholds: { statements: 44, branches: 40, functions: 40, lines: 44 },
    },
  },
});
