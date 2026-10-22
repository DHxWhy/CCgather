import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup/isolate-environment.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    testTimeout: 10000,
  },
});
