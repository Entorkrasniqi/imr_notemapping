import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // The `@/…` import paths from tsconfig.json.
    tsconfigPaths: true,
    alias: {
      // The real package throws when imported outside a React Server
      // Components build — which is its whole job in the app, and exactly
      // what a unit test importing server code shouldn't trip over.
      "server-only": fileURLToPath(new URL("./tests/unit/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "macos/**"],
  },
});
