import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getIssuePanelSpec } from "../../server/utils/view-specs";
import { validateViewSpec } from "../../shared/validate-view";
import { createSpecCache, type SpecMetadata } from "../../app/utils/spec-cache";
import {
  registerSpecInspector,
  setupSpecInspectorPlugin,
  specInspectorId,
} from "../../app/utils/spec-devtools";
import { guardSpecPersona, specPersonaMismatch } from "../../app/utils/spec-persona";

const metadata: SpecMetadata = {
  workspace: "orbit",
  persona: "employee",
  view: "issue-detail",
  issue: "ENG-1",
};
const spec = (root: string) =>
  ({ root, elements: { [root]: { type: "Text", props: { text: root } } } }) as never;
const validSpec = getIssuePanelSpec("guest", { id: "ENG-1", status: "Done" } as never);
const defer = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

void describe("Spec cache controller", () => {
  void it("preserves independent server and override values across refetch, cache hit, workflow and history trimming", async () => {
    const cache = createSpecCache();
    let fetches = 0;
    const fetch = async () => {
      fetches++;
      return spec("server");
    };
    const entry = await cache.select("a", metadata, fetch);
    assert.equal(entry.latest?.root, "server");
    const localOverride = spec("override");
    cache.apply("a", localOverride);
    (localOverride as { root: string }).root = "mutated";
    assert.equal((entry.override as { root: string }).root, "override");
    await cache.refetch("a", async () => spec("new-server"));
    await cache.select("a", metadata, fetch);
    assert.equal(entry.latest?.root, "new-server");
    assert.equal((entry.override as { root: string }).root, "override");
    assert.equal(entry.history.at(-1)?.kind, "cache-hit");
    assert.equal(fetches, 1);
    let requestedStatus = "";
    await cache.select("a", { ...metadata, status: "In Progress" }, async (requestMetadata) => {
      fetches++;
      requestedStatus = requestMetadata.status ?? "";
      return spec("workflow-server");
    });
    assert.equal(requestedStatus, "In Progress");
    assert.equal(entry.latest?.root, "workflow-server");
    assert.equal((entry.override as { root: string }).root, "override");
    assert.equal(fetches, 2);
    for (let index = 0; index < 25; index++)
      await cache.refetch("a", async () => spec(`server-${index}`));
    assert.equal(entry.history.length, 40);
  });

  void it("marks older responses stale without changing the selected identity", async () => {
    const cache = createSpecCache();
    const first = defer<never>();
    const second = defer<never>();
    const a = cache.select("a", metadata, () => first.promise);
    const current = await cache.select("b", { ...metadata, issue: "ENG-2" }, async () =>
      spec("current-view"),
    );
    const b = cache.refetch("a", () => second.promise);
    second.resolve(spec("newest"));
    await b;
    first.resolve(spec("older"));
    await a;
    const entry = cache.entries.get("a")!;
    assert.equal(entry.latest?.root, "newest");
    assert.equal(entry.history.at(-1)?.kind, "stale");
    assert.notEqual(entry.history[0]?.requestId, entry.history[1]?.requestId);
    assert.equal(entry.history[1]?.snapshot, null);
    assert.equal(entry.history.at(-2)?.snapshot?.root, "newest");
    assert.equal(entry.history.at(-1)?.snapshot?.root, "older");
    assert.equal(cache.current?.identity, "b");
    assert.equal(cache.current, current);
    assert.equal(cache.current?.latest?.root, "current-view");
  });

  void it("recovers from failed background refetch without discarding displayed spec", async () => {
    const cache = createSpecCache();
    await cache.select("a", metadata, async () => spec("cached"));
    await cache.refetch("a", async () => {
      throw new Error("offline");
    });
    const entry = cache.entries.get("a")!;
    assert.equal(entry.latest?.root, "cached");
    assert.equal(entry.error, "offline");
    await cache.select("a", metadata, async () => spec("recovered"), true);
    assert.equal(entry.latest?.root, "recovered");
    assert.equal(entry.error, null);
  });

  void it("rejects inactive persona fetches with an actionable error while retaining cache and override", async () => {
    const cache = createSpecCache();
    assert.equal(specPersonaMismatch("employee", "employee"), null);
    const error = specPersonaMismatch("guest", "employee");
    assert.match(error ?? "", /Switch personas first/);
    const entry = await cache.select(
      "orbit:guest:issue-detail:ENG-1",
      { ...metadata, persona: "guest" },
      async () => spec("guest-server"),
    );
    cache.apply(entry.identity, spec("local-override"));
    let fetches = 0;
    const rejected = guardSpecPersona(entry.metadata.persona, "employee", (message) =>
      cache.reportError(entry.identity, message),
    );
    if (!rejected)
      await cache.refetch(entry.identity, async () => {
        fetches++;
        return spec("wrong-persona");
      });
    assert.equal(rejected, true);
    assert.equal(fetches, 0);
    assert.match(entry.error ?? "", /Switch personas first/);
    assert.equal(entry.latest?.root, "guest-server");
    assert.equal(entry.override?.root, "local-override");
  });
});

void describe("Vue DevTools bridge", () => {
  void it("targets identity drafts and validates real specs while applying, clearing and invalidating cache entries", async () => {
    const cache = createSpecCache();
    const a = await cache.select("orbit:employee:ENG-1", metadata, async () => spec("server-a"));
    const b = await cache.select(
      "sandbox:guest:projects",
      { ...metadata, workspace: "sandbox", persona: "guest", view: "projects", issue: undefined },
      async () => spec("server-b"),
    );
    const c = await cache.select("orbit:guest:ENG-1", { ...metadata, persona: "guest" }, async () =>
      spec("server-c"),
    );
    cache.apply(a.identity, spec("override-a"));
    let current = b.identity;
    const app = {} as never;
    let treeHandler: ((payload: never) => void) | undefined;
    let stateHandler: ((payload: never) => void) | undefined;
    let editHandler: ((payload: never) => void) | undefined;
    let inspectorActions: { tooltip: string; action: () => void | Promise<void> }[] = [];
    let trees = 0;
    let states = 0;
    let appliedValidSpec = false;
    const mockApi = {
      addInspector: (options: { actions: typeof inspectorActions }) => {
        inspectorActions = options.actions;
      },
      on: {
        getInspectorTree: (handler: (payload: never) => void) => {
          treeHandler = handler;
        },
        getInspectorState: (handler: (payload: never) => void) => {
          stateHandler = handler;
        },
        editInspectorState: (handler: (payload: never) => void) => {
          editHandler = handler;
        },
      },
      sendInspectorTree: () => {
        trees++;
      },
      sendInspectorState: () => {
        states++;
      },
    };
    let bridge: ReturnType<typeof registerSpecInspector> | undefined;
    let pluginSetup:
      | Parameters<typeof import("@vue/devtools-api").setupDevToolsPlugin>[1]
      | undefined;
    let pluginDescriptor: { id: string; label: string; app: object } | undefined;
    const disposePlugin = setupSpecInspectorPlugin(
      (descriptor, setup) => {
        pluginDescriptor = descriptor;
        pluginSetup = setup;
      },
      cache,
      () => current,
      {
        apply: (identity, input) => {
          try {
            const validated = validateViewSpec(JSON.parse(input));
            cache.apply(identity, validated);
            appliedValidSpec = true;
            return { ok: true, message: "Applied validated Spec. Server Spec unchanged." };
          } catch (error) {
            return { ok: false, message: error instanceof Error ? error.message : String(error) };
          }
        },
        refetch: (identity) => cache.refetch(identity, async () => validSpec),
        clear: (identity) => cache.clear(identity),
        invalidate: (identity) => cache.invalidate(identity, async () => validSpec),
      },
      app,
      (inspector) => {
        bridge = inspector;
      },
      () => false,
    );
    assert.deepEqual(pluginDescriptor, { id: "json-render-spec", label: "JSON Render Spec", app });
    pluginSetup!(mockApi as never);
    assert.ok(bridge);
    const payload = {
      app,
      inspectorId: specInspectorId,
      rootNodes: [] as {
        id: string;
        label: string;
        children?: { id: string; label: string; children?: { id: string; label: string }[] }[];
      }[],
    };
    treeHandler!(payload as never);
    assert.equal(payload.rootNodes.length, 3);
    assert.ok(
      payload.rootNodes.some((node) => node.id === `cache:${encodeURIComponent(a.identity)}`),
    );
    const foreignPayload = { ...payload, app: {}, rootNodes: [] };
    treeHandler!(foreignPayload as never);
    assert.deepEqual(foreignPayload.rootNodes, []);

    const state = (identity: string, part: string) => {
      const statePayload = {
        app,
        inspectorId: specInspectorId,
        nodeId: `${encodeURIComponent(identity)}:${part}`,
        state: {} as Record<string, { key: string; value: unknown; editable?: boolean }[]>,
      };
      stateHandler!(statePayload as never);
      return statePayload.state;
    };
    const rootState = {
      app,
      inspectorId: specInspectorId,
      nodeId: `cache:${encodeURIComponent(a.identity)}`,
      state: {} as Record<string, { key: string; value: unknown }[]>,
    };
    stateHandler!(rootState as never);
    const action = (label: string) =>
      inspectorActions.find((item) => item.tooltip.toLowerCase().includes(label))!.action;
    await action("refetch")();
    assert.equal(a.latest?.root, validSpec.root);

    state(a.identity, "draft");
    editHandler!({
      app,
      inspectorId: specInspectorId,
      nodeId: `${encodeURIComponent(a.identity)}:draft`,
      path: ["JSON"],
      state: { value: "draft-a" },
    } as never);
    state(b.identity, "draft");
    editHandler!({
      app,
      inspectorId: specInspectorId,
      nodeId: `${encodeURIComponent(b.identity)}:draft`,
      path: ["JSON"],
      state: { value: JSON.stringify({ root: "missing", elements: {} }) },
    } as never);
    await action("apply")();
    assert.match(String(state(b.identity, "draft").Draft?.[1]?.value), /Invalid view structure/);
    assert.equal(b.override, null);
    assert.equal(appliedValidSpec, false);
    assert.equal(state(a.identity, "draft").Draft?.[0]?.value, "draft-a");
    state(b.identity, "draft");

    editHandler!({
      app,
      inspectorId: specInspectorId,
      nodeId: `${encodeURIComponent(b.identity)}:draft`,
      path: ["JSON"],
      state: { value: JSON.stringify(validSpec) },
    } as never);
    await action("apply")();
    assert.equal(appliedValidSpec, true);
    assert.equal((b.override as { root: string } | null)?.root, validSpec.root);
    assert.equal(b.latest?.root, "server-b");
    assert.equal(
      state(b.identity, "draft").Draft?.[1]?.value,
      "Applied validated Spec. Server Spec unchanged.",
    );

    await action("clear")();
    assert.equal(b.override, null);
    await action("apply")();
    await action("invalidate")();
    assert.equal(b.latest?.root, validSpec.root);
    assert.ok(b.override);
    await action("clear")();
    assert.equal(b.override, null);

    state(c.identity, "draft");
    const treesBeforeDispose = trees;
    const statesBeforeDispose = states;
    disposePlugin();
    bridge!.refresh();
    await action("refetch")();
    editHandler!({
      app,
      inspectorId: specInspectorId,
      nodeId: `${encodeURIComponent(c.identity)}:draft`,
      path: ["JSON"],
      state: { value: JSON.stringify(validSpec) },
    } as never);
    assert.equal(trees, treesBeforeDispose);
    assert.equal(states, statesBeforeDispose);
    assert.equal(c.override, null);
    assert.ok(treesBeforeDispose > 0 && statesBeforeDispose > 0);
  });
});
