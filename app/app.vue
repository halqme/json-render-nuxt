<script setup lang="ts">
import { ActionProvider, Renderer, StateProvider, VisibilityProvider } from "@json-render/vue";
import { validateViewSpec } from "../shared/validate-view";
import { createTrackerRegistry } from "./utils/registry";
import { createSpecCache, type SpecEntry, type SpecMetadata } from "./utils/spec-cache";
import { guardSpecPersona, specPersonaMismatch } from "./utils/spec-persona";

const nuxtApp = useNuxtApp();
const tracker = useTracker();
function resolveRepeatActionValue(value: string) {
  const resolved = value.startsWith("/") ? tracker.store.get(value) : value;
  return typeof resolved === "string" ? resolved : value;
}
const { registry, handlers } = createTrackerRegistry({
  navigateToIssues: () => tracker.navigate("issues"),
  openNewIssue: () => {
    if (tracker.canWrite.value) tracker.newIssueOpen.value = true;
  },
  resetFilters: tracker.resetFilters,
  openIssue: (issueId) => tracker.openIssue(resolveRepeatActionValue(issueId)),
  toggleIssueSelection: (issueId) =>
    tracker.toggleIssueSelection(resolveRepeatActionValue(issueId)),
  openProject: (projectId) => tracker.navigate("issues", resolveRepeatActionValue(projectId)),
  workflowAction: tracker.workflowAction,
  backToIssues: () => tracker.openIssue(""),
  addComment: tracker.addComment,
  changeProperty: tracker.changeProperty,
});
const actionHandlers = handlers(
  () => (updater) => {
    const next = updater(tracker.store.getSnapshot());
    tracker.store.update(
      Object.fromEntries(Object.entries(next).map(([key, value]) => [`/${key}`, value])),
    );
  },
  () => tracker.store.getSnapshot(),
);

const activeEntry = shallowRef<SpecEntry | null>(null);
let refreshInspector = () => {};
let disposeInspector = () => {};
let scopeDisposed = false;
onScopeDispose(() => {
  scopeDisposed = true;
  disposeInspector();
});
const specCache = createSpecCache({
  onChange: () => {
    triggerRef(activeEntry);
    refreshInspector();
    for (const listener of specCacheListeners) listener();
  },
});
const specCacheListeners = new Set<() => void>();
const devtoolsBridgeKey = "__JSON_RENDER_SPEC_CACHE__" as const;
type SpecCacheBridge = {
  entries: () => SpecEntry[];
  current: () => string | null;
  subscribe: (listener: () => void) => () => void;
  apply: typeof applyDraft;
  refetch: (identity: string) => Promise<void>;
  clear: (identity: string) => void;
  invalidate: (identity: string) => Promise<void>;
};
const viewRetry = ref(0);
const renderError = ref(false);
const activeSpec = computed(() => activeEntry.value?.override ?? activeEntry.value?.latest ?? null);
const viewLoading = computed(() => activeEntry.value?.loading ?? false);
const viewError = computed(() => !activeSpec.value && !!activeEntry.value?.error);
const issueComposerLoaded = ref(false);
const viewKey = computed(() => {
  const state = tracker.state.value;
  const issue = state.selectedIssue;
  return [
    state.workspaceId,
    state.persona,
    state.view,
    issue ? "issue-detail" : "list",
    issue?.id ?? "",
  ].join(":");
});
const viewName = computed(() => {
  if (tracker.state.value.selectedIssue) return "issue detail";
  switch (tracker.state.value.view) {
    case "my-issues":
      return "my issues";
    case "projects":
      return "projects";
    default:
      return "issues";
  }
});
const isDetailView = computed(() => !!tracker.state.value.selectedIssue);
const viewErrorMessage = computed(
  () =>
    `The ${viewName.value} view could not be loaded: ${activeEntry.value?.error ?? "unknown error"}`,
);
async function fetchSpec(metadata: SpecMetadata) {
  const mismatch = specPersonaMismatch(metadata.persona, tracker.state.value.persona);
  if (mismatch) throw new Error(mismatch);
  const input = await $fetch<unknown>(`/api/views/${metadata.view}`, {
    query: metadata.issue
      ? { workspace: metadata.workspace, issue: metadata.issue }
      : { workspace: metadata.workspace },
    retry: 0,
  });
  return validateViewSpec(input);
}
let seenRetry = 0;
watch(
  () => [viewKey.value, viewRetry.value, tracker.state.value.selectedIssue?.status] as const,
  async ([identity, retryCount]) => {
    const force = retryCount > seenRetry;
    seenRetry = retryCount;
    renderError.value = false;
    const state = tracker.state.value;
    const issue = state.selectedIssue;
    const metadata: SpecMetadata = {
      workspace: state.workspaceId,
      persona: state.persona,
      view: issue ? "issue-detail" : state.view,
      ...(issue ? { issue: issue.id, status: issue.status } : {}),
    };
    const identityKey = String(identity);
    activeEntry.value = specCache.get(identityKey, metadata);
    await specCache.select(identityKey, metadata, fetchSpec, force);
  },
  { flush: "sync", immediate: true },
);
function rejectInactivePersona(identity: string) {
  const entry = specCache.entries.get(identity);
  if (!entry) return false;
  return guardSpecPersona(entry.metadata.persona, tracker.state.value.persona, (message) =>
    specCache.reportError(identity, message),
  );
}
async function refetchSpec(identity = specCache.current?.identity) {
  if (identity && !rejectInactivePersona(identity)) await specCache.refetch(identity, fetchSpec);
}
async function invalidateSpec(identity = specCache.current?.identity) {
  if (identity && !rejectInactivePersona(identity)) await specCache.invalidate(identity, fetchSpec);
}
function applyDraft(identity: string, input: string) {
  try {
    const entry = specCache.entries.get(identity);
    if (!entry) return { ok: false, message: "No cached Spec is selected." };
    const spec = validateViewSpec(JSON.parse(input));
    specCache.apply(identity, spec);
    renderError.value = false;
    return { ok: true, message: "Override applied to the Renderer. Server Spec unchanged." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
function restoreSpec(identity = specCache.current?.identity) {
  if (identity) specCache.clear(identity);
  renderError.value = false;
}
if (import.meta.dev && import.meta.client) {
  const host = window as Window & { __JSON_RENDER_SPEC_CACHE__?: SpecCacheBridge };
  const bridge: SpecCacheBridge = {
    entries: () => [...specCache.entries.values()],
    current: () => specCache.current?.identity ?? null,
    subscribe: (listener) => {
      specCacheListeners.add(listener);
      return () => specCacheListeners.delete(listener);
    },
    apply: applyDraft,
    refetch: refetchSpec,
    clear: restoreSpec,
    invalidate: invalidateSpec,
  };
  host[devtoolsBridgeKey] = bridge;
  onScopeDispose(() => {
    if (host[devtoolsBridgeKey] === bridge) delete host[devtoolsBridgeKey];
    specCacheListeners.clear();
  });
  void Promise.all([import("@vue/devtools-api"), import("./utils/spec-devtools")]).then(
    ([devtools, bridge]) => {
      if (scopeDisposed) return;
      disposeInspector = bridge.setupSpecInspectorPlugin(
        devtools.setupDevToolsPlugin,
        specCache,
        () => specCache.current?.identity ?? null,
        {
          apply: applyDraft,
          refetch: refetchSpec,
          clear: restoreSpec,
          invalidate: invalidateSpec,
        },
        nuxtApp.vueApp,
        (inspector) => {
          refreshInspector = inspector.refresh;
          refreshInspector();
        },
        () => scopeDisposed,
      );
    },
  );
}
function retryView() {
  viewRetry.value += 1;
}
function handleViewRenderError(error: unknown) {
  console.error("json-render view render error", error);
  renderError.value = true;
}
watch(
  tracker.newIssueOpen,
  (open) => {
    if (open) issueComposerLoaded.value = true;
  },
  { immediate: true },
);
const notice = computed(() => tracker.state.value.notice);
</script>

<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <AppShell>
      <div class="view-workbench">
        <div class="view-preview">
          <StateProvider :store="tracker.store">
            <ActionProvider :handlers="actionHandlers">
              <div v-if="viewError" class="view-status" role="alert">
                <p>{{ viewErrorMessage }}</p>
                <div class="view-status-actions">
                  <UButton
                    label="Retry view"
                    color="neutral"
                    variant="outline"
                    @click="retryView"
                  />
                  <UButton
                    v-if="isDetailView"
                    label="Close issue"
                    color="neutral"
                    variant="ghost"
                    @click="tracker.openIssue('')"
                  />
                </div>
              </div>
              <div v-else-if="!activeSpec && viewLoading" class="view-loading" role="status">
                <USkeleton class="h-24 w-full" />
                <span class="sr-only">Loading {{ viewName }} view…</span>
              </div>
              <div v-else-if="renderError" class="view-status" role="alert">
                <p>This {{ viewName }} view could not be rendered.</p>
                <UButton
                  label="Restore server Spec"
                  color="neutral"
                  variant="outline"
                  @click="restoreSpec()"
                />
              </div>
              <RendererErrorBoundary v-else @error="handleViewRenderError">
                <VisibilityProvider>
                  <Renderer :spec="activeSpec" :registry="registry" />
                </VisibilityProvider>
              </RendererErrorBoundary>
            </ActionProvider>
          </StateProvider>
        </div>
      </div>
      <div v-if="notice" class="workspace-notice" role="status">
        <UIcon name="i-lucide-info" />
        <span>{{ notice }}</span>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Dismiss notification"
          @click="tracker.store.set('/notice', '')"
        />
      </div>
    </AppShell>
    <LazyNewIssueModal v-if="issueComposerLoaded && tracker.canWrite.value" />
  </UApp>
</template>
