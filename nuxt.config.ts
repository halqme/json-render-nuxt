// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  ssr: false,
  modules: ["@nuxt/ui", "./modules/spec-cache-devtools"],
  css: ["~/assets/css/main.css"],
  vite: {
    // Nitro needs the server entry's exports; only split the client build here.
    $client: {
      build: {
        rolldownOptions: {
          preserveEntrySignatures: false,
          output: {
            strictExecutionOrder: true,
            codeSplitting: {
              includeDependenciesRecursively: false,
              groups: [
                {
                  name: "vue-runtime",
                  test: /node_modules[\\/](?:@vue[\\/][^\\/]+|vue|vue-router)[\\/]/,
                },
                {
                  name: "nuxt-ui",
                  test: /node_modules[\\/](?:@nuxt[\\/]ui|reka-ui|tailwind-variants|tailwind-merge|@floating-ui[\\/][^\\/]+|@vueuse[\\/][^\\/]+)[\\/]|[\\/]\.nuxt[\\/]ui[\\/]/,
                },
                {
                  name: "json-render",
                  test: /node_modules[\\/](?:@json-render[\\/][^\\/]+|zod)[\\/]/,
                },
              ],
            },
          },
        },
      },
    },
  },
  colorMode: { preference: "dark", fallback: "dark", disableTransition: true },
  icon: { clientBundle: { scan: true, includeCustomCollections: true }, provider: "server" },
  app: { head: { title: "Orbit — Issue tracker", htmlAttrs: { lang: "en" } } },
});
