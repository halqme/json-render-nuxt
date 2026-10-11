<script setup lang="ts">
import { ActionProvider, Renderer, StateProvider, VisibilityProvider } from "@json-render/vue";
import type { Spec } from "@json-render/core";
import { validateViewSpec } from "../shared/validate-view";
import { createTrackerRegistry } from "./utils/registry";

const tracker = useTracker();
const { registry, handlers } = createTrackerRegistry(tracker.handlers);
const actionHandlers = handlers(
  () => (updater) => {
    const next = updater(tracker.store.getSnapshot());
    tracker.store.update(
      Object.fromEntries(Object.entries(next).map(([key, value]) => [`/${key}`, value])),
    );
  },
  () => tracker.store.getSnapshot(),
);
const viewName = computed(() =>
  tracker.state.value.selectedIssue
    ? "issue-detail"
    : tracker.state.value.view === "projects"
      ? "projects"
      : tracker.state.value.view === "my-issues"
        ? "my-issues"
        : "all-issues",
);
const {
  data: spec,
  status,
  error,
  refresh,
} = await useFetch(() => `/api/views/${viewName.value}`, {
  server: false,
  transform: validateViewSpec,
});
// UI overrides are intentionally separate from fetched specs and persisted tracker data.
const inspectOpen = ref(false);
const issueComposerLoaded = ref(false);
// Keep the modal mounted after its first use so closing transitions and focus restoration finish.
watch(
  tracker.newIssueOpen,
  (open) => {
    if (open) issueComposerLoaded.value = true;
  },
  { immediate: true },
);
const specOverrides = shallowRef<Record<string, Spec>>({});
const activeSpec = computed(() => specOverrides.value[viewName.value] ?? spec.value ?? null);
const hasOverride = computed(() => Object.hasOwn(specOverrides.value, viewName.value));
function applySpec(next: Spec) {
  specOverrides.value = { ...specOverrides.value, [viewName.value]: next };
  renderError.value = false;
}
function restoreSpec() {
  const next = { ...specOverrides.value };
  delete next[viewName.value];
  specOverrides.value = next;
  renderError.value = false;
}
async function closeInspector() {
  inspectOpen.value = false;
  await nextTick();
  document.querySelector<HTMLButtonElement>('button[aria-label="Inspect UI"]')?.focus();
}
const renderError = ref(false);
watch(viewName, () => {
  renderError.value = false;
});
onErrorCaptured(() => {
  renderError.value = true;
  return false;
});
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
              <VisibilityProvider>
                <div v-if="(error && !hasOverride) || renderError" class="view-status" role="alert">
                  <UIcon name="i-lucide-triangle-alert" />
                  <h1>This view couldn't be loaded</h1>
                  <p>Your local changes are safe. Try loading the view again.</p>
                  <UButton
                    label="Retry"
                    color="neutral"
                    @click="
                      renderError = false;
                      refresh();
                    "
                  />
                </div>
                <div
                  v-else-if="(!hasOverride && status === 'pending') || !activeSpec"
                  class="view-loading"
                  role="status"
                  aria-label="Loading view"
                >
                  <USkeleton class="h-8 w-48" />
                  <USkeleton class="mt-6 h-10 w-full" />
                  <USkeleton v-for="i in 7" :key="i" class="mt-4 h-8 w-full" />
                  <span class="sr-only">Loading view…</span>
                </div>
                <Renderer v-else :key="viewName" :spec="activeSpec!" :registry="registry" />
              </VisibilityProvider>
            </ActionProvider>
          </StateProvider>
        </div>
        <LazySpecInspector
          v-if="inspectOpen"
          id="ui-spec-inspector"
          :spec="activeSpec"
          :view-name="viewName"
          :modified="hasOverride"
          :loading="!hasOverride && status === 'pending'"
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
    <LazyNewIssueModal v-if="issueComposerLoaded" />
  </UApp>
</template>

<style scoped>
.view-workbench {
  min-width: 0;
}
.view-workbench.inspecting {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 420px;
  align-items: start;
}
.view-preview {
  min-width: 0;
}
@media (max-width: 1000px) {
  .view-workbench.inspecting {
    grid-template-columns: minmax(0, 1fr);
  }
  .view-workbench.inspecting :deep(.spec-inspector) {
    order: -1;
  }
}
</style>
