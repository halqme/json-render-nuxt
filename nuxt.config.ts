// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  ssr: false,
  modules: ["@nuxt/ui"],
  css: ["~/assets/css/main.css"],
  colorMode: { preference: "dark", fallback: "dark" },
  icon: { clientBundle: { scan: true, includeCustomCollections: true }, provider: "server" },
  app: { head: { title: "Orbit — Issue tracker", htmlAttrs: { lang: "en", class: "dark" } } },
});
