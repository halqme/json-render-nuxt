import {
  computed,
  createApp,
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  reactive,
  ref,
} from "vue";
import type { SpecEntry } from "../app/utils/spec-cache";

type Bridge = {
  entries: () => SpecEntry[];
  current: () => string | null;
  subscribe: (callback: () => void) => () => void;
  apply: (identity: string, input: string) => { ok: boolean; message: string };
  refetch: (identity: string) => Promise<void>;
  clear: (identity: string) => void;
  invalidate: (identity: string) => Promise<void>;
};

const appWindow = window.top as Window & { __JSON_RENDER_SPEC_CACHE__?: Bridge };
let bridge: Bridge | undefined;
try {
  if (window.top !== window && window.top?.location.origin === window.location.origin)
    bridge = appWindow.__JSON_RENDER_SPEC_CACHE__;
} catch {
  bridge = undefined;
}

const format = (value: unknown) => (value == null ? "" : JSON.stringify(value, null, 2));

const Panel = defineComponent({
  setup() {
    const entries = ref<SpecEntry[]>([]);
    const selected = ref("");
    const drafts = reactive(new Map<string, string>());
    const message = ref("");
    let unsubscribe: (() => void) | undefined;
    let themeObserver: MutationObserver | undefined;
    let themeRoot: HTMLElement | undefined;
    const syncTheme = () => {
      const isDark = themeRoot?.classList.contains("dark") ?? false;
      document.documentElement.classList.toggle("dark", isDark);
      document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    };
    const entry = computed(() => entries.value.find((item) => item.identity === selected.value));
    const draft = computed({
      get: () => drafts.get(selected.value) ?? format(entry.value?.override ?? entry.value?.latest),
      set: (value: string) => drafts.set(selected.value, value),
    });
    const sync = () => {
      entries.value = bridge?.entries() ?? [];
      if (!entries.value.some((item) => item.identity === selected.value))
        selected.value = bridge?.current() ?? entries.value[0]?.identity ?? "";
      const current = entry.value;
      const currentSpec = current?.override ?? current?.latest;
      if (current && currentSpec != null && !drafts.has(current.identity))
        drafts.set(current.identity, format(currentSpec));
    };
    const act = async (action: "apply" | "refetch" | "clear" | "invalidate") => {
      if (!bridge || !selected.value) return;
      const identity = selected.value;
      if (action === "apply") {
        message.value = bridge.apply(identity, drafts.get(identity) ?? "").message;
      } else if (action === "clear") {
        bridge.clear(identity);
        message.value = "Override cleared; showing the latest server Spec.";
      } else {
        message.value =
          action === "refetch" ? "Refetch in progress…" : "Invalidating and refetching…";
        await bridge[action](identity);
        sync();
        message.value = entry.value?.error
          ? `Request failed: ${entry.value.error}`
          : action === "refetch"
            ? "Refetch complete; any override is retained."
            : "Cache invalidated and refetched.";
      }
      sync();
    };
    const specSection = (title: string, spec: unknown) =>
      h("details", { class: "spec-view", open: title === "Effective Spec" }, [
        h("summary", `${title}${spec == null ? " · not loaded" : ""}`),
        spec == null
          ? h("p", "No Spec available.")
          : [
              title === "Effective Spec" && typeof spec === "object"
                ? h(
                    "ul",
                    { class: "element-list", "aria-label": "Effective element tree" },
                    Object.entries(
                      (spec as { elements?: Record<string, { type?: string }> }).elements ?? {},
                    ).map(([id, element]) =>
                      h("li", [h("code", id), ` · ${element.type ?? "element"}`]),
                    ),
                  )
                : null,
              h("pre", format(spec)),
            ],
      ]);
    onMounted(() => {
      sync();
      unsubscribe = bridge?.subscribe(sync);
      try {
        if (window.parent !== window) {
          themeRoot = window.parent.document.documentElement;
          syncTheme();
          themeObserver = new MutationObserver(syncTheme);
          themeObserver.observe(themeRoot, { attributes: true, attributeFilter: ["class"] });
        }
      } catch {
        themeRoot = undefined;
      }
    });
    onUnmounted(() => {
      unsubscribe?.();
      themeObserver?.disconnect();
    });
    return () =>
      h("main", { class: "panel" }, [
        h("header", [
          h("div", [
            h("h1", "Spec Cache"),
            h("p", bridge ? "Development renderer cache" : "Waiting for the app connection…"),
          ]),
        ]),
        bridge
          ? h("section", [
              h("label", { for: "cache-entry" }, "Cached view"),
              h(
                "select",
                {
                  id: "cache-entry",
                  value: selected.value,
                  onChange: (event: Event) => {
                    selected.value = (event.target as HTMLSelectElement).value;
                    const selectedSpec = entry.value?.override ?? entry.value?.latest;
                    if (selectedSpec != null && !drafts.has(selected.value))
                      drafts.set(selected.value, format(selectedSpec));
                    message.value = "";
                  },
                },
                entries.value.map((item) =>
                  h(
                    "option",
                    { value: item.identity },
                    `${item.metadata.view}${item.metadata.issue ? ` · ${item.metadata.issue}` : ""}${item.identity === bridge.current() ? " · current" : ""}`,
                  ),
                ),
              ),
              entry.value
                ? [
                    h(
                      "div",
                      { class: "meta" },
                      Object.entries(entry.value.metadata).map(([key, value]) =>
                        h("span", `${key}: ${value ?? "—"}`),
                      ),
                    ),
                    h(
                      "p",
                      { role: "status" },
                      entry.value.loading
                        ? "Loading server Spec…"
                        : entry.value.error
                          ? `Error: ${entry.value.error}`
                          : entry.value.override
                            ? "Override active · server Spec unchanged"
                            : "Using server Spec",
                    ),
                    h("div", { class: "actions" }, [
                      h("button", { onClick: () => void act("apply") }, "Apply draft"),
                      h("button", { onClick: () => void act("refetch") }, "Refetch"),
                      h("button", { onClick: () => void act("clear") }, "Clear override"),
                      h(
                        "button",
                        { onClick: () => void act("invalidate") },
                        "Invalidate & refetch",
                      ),
                    ]),
                    h("h2", "Specs"),
                    specSection("Server Spec", entry.value.latest),
                    specSection("Override", entry.value.override),
                    specSection("Effective Spec", entry.value.override ?? entry.value.latest),
                    h("label", { for: "spec-draft" }, "Draft JSON"),
                    h("textarea", {
                      id: "spec-draft",
                      spellcheck: "false",
                      value: draft.value,
                      placeholder: entry.value.latest
                        ? undefined
                        : "Waiting for the first server Spec…",
                      onInput: (event: Event) => {
                        draft.value = (event.target as HTMLTextAreaElement).value;
                        message.value = "";
                      },
                    }),
                    h("p", { role: "status", "aria-live": "polite" }, message.value),
                    h("h2", `Request history (${entry.value.history.length})`),
                    h(
                      "ol",
                      { class: "history" },
                      [...entry.value.history]
                        .reverse()
                        .map((event) =>
                          h("li", [
                            h("strong", `#${event.requestId} ${event.kind}`),
                            h(
                              "span",
                              `${new Date(event.at).toLocaleTimeString()}${event.duration == null ? "" : ` · ${event.duration} ms`}`,
                            ),
                            event.message ? h("p", event.message) : null,
                            h("details", [
                              h("summary", "Snapshot and metadata"),
                              h(
                                "pre",
                                JSON.stringify(
                                  { metadata: event.metadata, snapshot: event.snapshot },
                                  null,
                                  2,
                                ),
                              ),
                            ]),
                          ]),
                        ),
                    ),
                  ]
                : h("p", "No cached Specs yet. Navigate to a view in the app."),
            ])
          : h(
              "p",
              { role: "status" },
              "Open this tab from the Nuxt DevTools sidebar in the app window.",
            ),
      ]);
  },
});

const style = document.createElement("style");
style.textContent = `:root{font:13px/1.45 ui-sans-serif,system-ui,sans-serif;color-scheme:light dark}*{box-sizing:border-box}body{margin:0;background:Canvas;color:CanvasText}.panel{padding:16px;max-width:1000px}header{display:flex;justify-content:space-between;border-bottom:1px solid color-mix(in srgb,CanvasText 18%,transparent);margin-bottom:16px}h1{font-size:18px;margin:0}h2{font-size:14px;margin:20px 0 8px}p{margin:8px 0}label{display:block;font-weight:600;margin:12px 0 5px}select,textarea{width:100%;font:inherit;color:inherit;background:Canvas;border:1px solid color-mix(in srgb,CanvasText 30%,transparent);border-radius:5px;padding:8px}textarea{min-height:180px;resize:vertical;font:12px/1.5 ui-monospace,monospace}.meta{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}.meta span{padding:3px 6px;border-radius:4px;background:color-mix(in srgb,CanvasText 8%,Canvas)}.actions{display:flex;gap:6px;flex-wrap:wrap}button{font:inherit;color:inherit;background:color-mix(in srgb,CanvasText 9%,Canvas);border:1px solid color-mix(in srgb,CanvasText 25%,transparent);border-radius:5px;padding:6px 10px;cursor:pointer}button:hover{background:color-mix(in srgb,CanvasText 16%,Canvas)}button:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid #42b883;outline-offset:2px}.spec-view{border:1px solid color-mix(in srgb,CanvasText 16%,transparent);border-radius:5px;margin:6px 0;padding:7px}.spec-view summary{cursor:pointer;font-weight:600}.spec-view pre{max-height:220px;overflow:auto;margin:8px 0;font-size:11px}.element-list{display:flex;gap:5px;flex-wrap:wrap;list-style:none;margin:8px 0;padding:0}.element-list li{padding:3px 6px;border-radius:4px;background:color-mix(in srgb,CanvasText 8%,Canvas)}.history{padding-left:20px}.history li{padding:6px 0;border-bottom:1px solid color-mix(in srgb,CanvasText 12%,transparent)}.history strong,.history span{margin-right:10px}pre{max-height:240px;overflow:auto;font-size:11px}`;
document.head.append(style);
createApp(Panel).mount("#app");
