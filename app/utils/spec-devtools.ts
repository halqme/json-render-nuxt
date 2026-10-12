import type { SpecCache, SpecEntry } from "./spec-cache";

const INSPECTOR_ID = "json-render-spec-cache";
type Node = {
  id: string;
  label: string;
  children?: Node[];
  tags?: { label: string; textColor: number; backgroundColor: number }[];
};
type StateItem = { key: string; value: unknown; editable?: boolean };
type Api = {
  addInspector(options: {
    id: string;
    label: string;
    icon: string;
    actions: { icon: string; tooltip: string; action: () => void | Promise<void> }[];
  }): void;
  on: {
    getInspectorTree(
      handler: (payload: { app: object; inspectorId: string; rootNodes: Node[] }) => void,
    ): void;
    getInspectorState(
      handler: (payload: {
        app: object;
        inspectorId: string;
        nodeId: string;
        state: Record<string, StateItem[]>;
      }) => void,
    ): void;
    editInspectorState(
      handler: (payload: {
        app: object;
        inspectorId: string;
        nodeId: string;
        path: string[];
        state: { value?: unknown };
      }) => void,
    ): void;
  };
  sendInspectorTree(id: string): void;
  sendInspectorState(id: string): void;
};
export type InspectorApplyResult = { ok: boolean; message: string };
export type InspectorActions = {
  apply(identity: string, input: string): InspectorApplyResult;
  refetch(identity: string): void | Promise<void>;
  clear(identity: string): void;
  invalidate(identity: string): void | Promise<void>;
};
const key = (identity: string) => encodeURIComponent(identity);
const child = (entry: SpecEntry, id: string, label: string): Node => ({
  id: `${key(entry.identity)}:${id}`,
  label,
});

export function setupSpecInspectorPlugin(
  setupDevToolsPlugin: typeof import("@vue/devtools-api").setupDevToolsPlugin,
  cache: SpecCache,
  currentIdentity: () => string | null,
  actions: InspectorActions,
  app: Parameters<typeof import("@vue/devtools-api").setupDevToolsPlugin>[0]["app"],
  onRegister: (inspector: ReturnType<typeof registerSpecInspector>) => void,
  isDisposed: () => boolean,
) {
  let disposed = false;
  let inspector: ReturnType<typeof registerSpecInspector> | undefined;
  setupDevToolsPlugin({ id: "json-render-spec", label: "JSON Render Spec", app }, (api) => {
    if (disposed || isDisposed()) return;
    inspector = registerSpecInspector(api, cache, currentIdentity, actions, app);
    onRegister(inspector);
  });
  return () => {
    disposed = true;
    inspector?.dispose();
  };
}

export function registerSpecInspector(
  api: Api,
  cache: SpecCache,
  currentIdentity: () => string | null,
  actions: InspectorActions,
  app: object,
) {
  let disposed = false;
  const drafts = new Map<string, string>();
  const messages = new Map<string, string>();
  let selectedIdentity: string | null = null;
  const refresh = () => {
    if (disposed) return;
    api.sendInspectorTree(INSPECTOR_ID);
    api.sendInspectorState(INSPECTOR_ID);
  };
  const target = () =>
    selectedIdentity && cache.entries.has(selectedIdentity) ? selectedIdentity : currentIdentity();
  const draftFor = (identity: string) =>
    drafts.get(identity) ??
    JSON.stringify(
      cache.entries.get(identity)?.override ?? cache.entries.get(identity)?.latest ?? {},
      null,
      2,
    );
  const perform = async (action: "refetch" | "clear" | "invalidate" | "apply") => {
    if (disposed) return;
    const identity = target();
    if (!identity) return;
    if (action === "refetch") await actions.refetch(identity);
    else if (action === "clear") actions.clear(identity);
    else if (action === "invalidate") await actions.invalidate(identity);
    else {
      const result = actions.apply(identity, draftFor(identity));
      messages.set(identity, result.message);
    }
    refresh();
  };
  api.addInspector({
    id: INSPECTOR_ID,
    label: "Spec Cache",
    icon: "storage",
    actions: [
      { icon: "refresh", tooltip: "Refetch selected Spec", action: () => perform("refetch") },
      { icon: "clear", tooltip: "Clear selected override", action: () => perform("clear") },
      {
        icon: "delete",
        tooltip: "Invalidate selected cache and refetch",
        action: () => perform("invalidate"),
      },
      {
        icon: "check",
        tooltip: "Validate and apply selected draft",
        action: () => perform("apply"),
      },
    ],
  });
  api.on.getInspectorTree((payload) => {
    if (disposed || payload.app !== app || payload.inspectorId !== INSPECTOR_ID) return;
    payload.rootNodes = [...cache.entries.values()].map((entry) => ({
      id: `cache:${key(entry.identity)}`,
      label: entry.metadata.issue
        ? `${entry.metadata.view} · ${entry.metadata.issue}`
        : entry.metadata.view,
      tags:
        entry.identity === currentIdentity()
          ? [{ label: "current", textColor: 0xffffff, backgroundColor: 0x42b883 }]
          : [],
      children: [
        child(entry, "metadata", "Metadata"),
        child(entry, "server", "Latest server Spec"),
        child(entry, "effective", "Effective Spec"),
        child(entry, "override", "Override"),
        child(entry, "draft", "Draft JSON"),
        child(entry, "status", "Request status"),
        ...Object.keys(entry.latest?.elements ?? {}).map((element) =>
          child(entry, `element:${element}`, `Server element · ${element}`),
        ),
        ...Object.keys((entry.override ?? entry.latest)?.elements ?? {}).map((element) =>
          child(entry, `effective-element:${element}`, `Effective element · ${element}`),
        ),
        {
          ...child(entry, "history", `History (${entry.history.length})`),
          children: entry.history.map((event) =>
            child(
              entry,
              `history:${event.requestId}:${event.kind}:${event.at}`,
              `${event.requestId} · ${event.kind}`,
            ),
          ),
        },
      ],
    }));
  });
  api.on.getInspectorState((payload) => {
    if (disposed || payload.app !== app || payload.inspectorId !== INSPECTOR_ID) return;
    if (payload.nodeId.startsWith("cache:")) {
      const identity = decodeURIComponent(payload.nodeId.slice("cache:".length));
      const entry = cache.entries.get(identity);
      if (!entry) return;
      selectedIdentity = identity;
      payload.state = {
        Cache: [
          { key: "identity", value: identity },
          { key: "metadata", value: entry.metadata },
          { key: "effective Spec", value: entry.override ?? entry.latest },
          { key: "loading", value: entry.loading },
          { key: "error", value: entry.error },
        ],
      };
      return;
    }
    const [encoded, part, ...rest] = payload.nodeId.split(":");
    const identity = decodeURIComponent(encoded ?? "");
    const entry = cache.entries.get(identity);
    if (!entry) return;
    selectedIdentity = identity;
    const field = (name: string, value: unknown, editable = false): StateItem => ({
      key: name,
      value,
      editable,
    });
    const effective = entry.override ?? entry.latest;
    if (part === "metadata")
      payload.state = {
        Metadata: Object.entries(entry.metadata).map(([name, value]) => field(name, value)),
      };
    else if (part === "server") payload.state = { Server: [field("validated Spec", entry.latest)] };
    else if (part === "effective") payload.state = { Effective: [field("Spec", effective)] };
    else if (part === "override") payload.state = { Override: [field("Spec", entry.override)] };
    else if (part === "draft")
      payload.state = {
        Draft: [
          field("JSON (edit, then Apply)", draftFor(identity), true),
          field("Result", messages.get(identity) ?? "No changes applied."),
        ],
      };
    else if (part === "status")
      payload.state = { Request: [field("loading", entry.loading), field("error", entry.error)] };
    else if (part === "history") {
      const event = entry.history.find(
        (item) =>
          item.requestId === Number(rest[0]) &&
          item.kind === rest[1] &&
          item.at === Number(rest[2]),
      );
      payload.state = {
        Request: event ? Object.entries(event).map(([name, value]) => field(name, value)) : [],
      };
    } else if (part === "element" || part === "effective-element") {
      const elementId = rest.join(":");
      const spec = part === "element" ? entry.latest : effective;
      payload.state = { Element: [field("element", spec?.elements[elementId])] };
    }
  });
  api.on.editInspectorState((payload) => {
    if (disposed || payload.app !== app || payload.inspectorId !== INSPECTOR_ID) return;
    const [encoded, part] = payload.nodeId.split(":");
    if (part !== "draft") return;
    const identity = decodeURIComponent(encoded ?? "");
    const value = payload.state.value;
    drafts.set(identity, typeof value === "string" ? value : JSON.stringify(value ?? ""));
    messages.delete(identity);
    refresh();
  });
  return {
    refresh,
    dispose() {
      disposed = true;
      drafts.clear();
      messages.clear();
    },
  };
}

export const specInspectorId = INSPECTOR_ID;
