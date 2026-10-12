import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: { ignorePatterns: [".agents/**"] },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    tasks: {
      build: "nuxt build",
      dev: "nuxt dev",
      generate: "nuxt generate",
      preview: "nuxt preview",
      postinstall: "nuxt prepare",
      "test:unit": "bun test tests/unit",
      "test:devtools": "playwright test --config playwright.devtools.config.ts",
      test: { command: "playwright test", cache: false, dependsOn: ["build", "test:unit"] },
      typecheck: "nuxt typecheck",
    },
  },
});
