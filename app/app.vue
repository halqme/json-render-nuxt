<script setup lang="ts">
import { ActionProvider, Renderer, StateProvider, VisibilityProvider } from "@json-render/vue";
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
    <AppShell>
      <StateProvider :store="tracker.store">
        <ActionProvider :handlers="actionHandlers">
          <VisibilityProvider>
            <div v-if="error || renderError" class="view-status" role="alert">
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
              v-else-if="status === 'pending' || !spec"
              class="view-loading"
              role="status"
              aria-label="Loading view"
            >
              <USkeleton class="h-8 w-48" />
              <USkeleton class="mt-6 h-10 w-full" />
              <USkeleton v-for="i in 7" :key="i" class="mt-4 h-8 w-full" />
              <span class="sr-only">Loading view…</span>
            </div>
            <Renderer v-else :key="viewName" :spec="spec" :registry="registry" />
          </VisibilityProvider>
        </ActionProvider>
      </StateProvider>
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
    <NewIssueModal />
  </UApp>
</template>
