<script setup lang="ts">
import { ActionProvider, Renderer, StateProvider, VisibilityProvider } from "@json-render/vue";
import type { Spec } from "@json-render/core";
import { validateViewSpec } from "../shared/validate-view";
import { createTrackerRegistry } from "./utils/registry";

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

const inspectOpen = ref(false);
const viewSpec = shallowRef<Spec | null>(null);
const viewOverride = shallowRef<Spec | null>(null);
let viewRequestGeneration = 0;
const viewError = ref(false);
const viewLoading = ref(false);
const viewRetry = ref(0);
const renderError = ref(false);
const hasOverride = computed(() => viewOverride.value !== null);
const activeSpec = computed(() => viewOverride.value ?? viewSpec.value);
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
    issue?.status ?? "",
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
const viewErrorMessage = computed(() => `The ${viewName.value} view could not be loaded.`);
watch(isDetailView, (isDetail) => {
  if (!isDetail) inspectOpen.value = false;
});

watch(
  () => [viewKey.value, viewRetry.value],
  async ([key]) => {
    const requestGeneration = ++viewRequestGeneration;
    const isCurrentRequest = () =>
      requestGeneration === viewRequestGeneration && viewKey.value === key;
    viewSpec.value = null;
    viewOverride.value = null;
    viewError.value = false;
    renderError.value = false;
    const keyAtStart = tracker.state.value;
    const issue = keyAtStart.selectedIssue;
    const view = issue ? "issue-detail" : keyAtStart.view;
    if (!issue && !["issues", "my-issues", "projects"].includes(view)) {
      viewError.value = true;
      viewLoading.value = false;
      return;
    }
    viewLoading.value = true;
    try {
      const input = await $fetch<unknown>(`/api/views/${view}`, {
        query: issue
          ? { workspace: keyAtStart.workspaceId, issue: issue.id }
          : { workspace: keyAtStart.workspaceId },
        retry: 0,
      });
      if (isCurrentRequest()) viewSpec.value = validateViewSpec(input);
    } catch {
      if (isCurrentRequest()) viewError.value = true;
    } finally {
      if (isCurrentRequest()) viewLoading.value = false;
    }
  },
  { flush: "sync", immediate: true },
);

function applySpec(spec: Spec) {
  viewOverride.value = spec;
  renderError.value = false;
}
function restoreSpec() {
  viewOverride.value = null;
  renderError.value = false;
}
async function closeInspector() {
  inspectOpen.value = false;
  await nextTick();
  document.querySelector<HTMLButtonElement>('button[aria-label="Inspect UI"]')?.focus();
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
    <AppShell :inspect-open="inspectOpen" @inspect="inspectOpen = !inspectOpen">
      <div class="view-workbench" :class="{ inspecting: inspectOpen }">
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
              <div v-else-if="viewLoading || !activeSpec" class="view-loading" role="status">
                <USkeleton class="h-24 w-full" />
                <span class="sr-only">Loading {{ viewName }} view…</span>
              </div>
              <div v-else-if="renderError" class="view-status" role="alert">
                <p>This {{ viewName }} view could not be rendered.</p>
                <UButton
                  label="Restore server Spec"
                  color="neutral"
                  variant="outline"
                  @click="restoreSpec"
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
        <LazySpecInspector
          v-if="inspectOpen && isDetailView"
          id="ui-spec-inspector"
          :spec="activeSpec"
          view-name="issue detail"
          :modified="hasOverride"
          :loading="viewLoading"
          @apply="applySpec"
          @reset="restoreSpec"
          @close="closeInspector"
        />
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
