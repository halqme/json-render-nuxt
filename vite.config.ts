import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {},
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
    },
  },
});
