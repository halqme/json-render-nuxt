import { fileURLToPath } from "node:url";
import { defineNuxtModule, addVitePlugin } from "@nuxt/kit";
import { addCustomTab } from "@nuxt/devtools-kit";
import type { Plugin } from "vite";

const panelEntry = fileURLToPath(new URL("../devtools/spec-cache-panel.ts", import.meta.url));

export default defineNuxtModule({
  meta: { name: "spec-cache-devtools" },
  setup(_options, nuxt) {
    if (!nuxt.options.dev) return;
    addCustomTab(
      {
        name: "json-render-spec-cache",
        title: "Spec Cache",
        icon: "carbon:data-base-alt",
        category: "vue-devtools",
        view: { type: "iframe", src: "/__spec-cache/" },
      },
      nuxt,
    );
    const plugin: Plugin = {
      name: "json-render-spec-cache-panel",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const path = request.url?.split("?")[0];
          if (path === "/__spec-cache/panel.js") {
            void server
              .transformRequest(panelEntry)
              .then((result) => {
                if (!result) {
                  response.statusCode = 500;
                  response.end("Unable to transform Spec Cache panel.");
                  return;
                }
                response.statusCode = 200;
                response.setHeader("Content-Type", "text/javascript; charset=utf-8");
                response.setHeader("Cache-Control", "no-store");
                response.end(result.code);
              })
              .catch(next);
            return;
          }
          if (path !== "/__spec-cache/") return next();
          response.statusCode = 200;
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.setHeader("Cache-Control", "no-store");
          response.end(
            `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Spec Cache</title></head><body><div id="app"></div><script type="module" src="/__spec-cache/panel.js"></script></body></html>`,
          );
        });
      },
    };
    addVitePlugin(plugin);
  },
});
