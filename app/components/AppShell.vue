<script setup lang="ts">
import type { Issue } from "../../shared/types";

const tracker = useTracker();
const workspace = computed(() => tracker.state.value.workspaceName);
const searchOpen = ref(false);
const search = ref("");
const activeResult = ref(0);
const navigation = [
  { label: "My issues", view: "my-issues", icon: "i-lucide-circle-user-round" },
  { label: "All issues", view: "issues", icon: "i-lucide-layers-2" },
  { label: "Projects", view: "projects", icon: "i-lucide-box" },
];
const heading = computed(
  () => navigation.find((item) => item.view === tracker.state.value.view)?.label ?? "All issues",
);
const activeProject = computed(() =>
  tracker.state.value.projects.find((project) => project.id === tracker.state.value.projectFilter),
);
function workspaceInformation() {
  tracker.store.set(
    "/notice",
    `${workspace.value} is a local demo workspace. Issues are saved separately for each workspace in this browser.`,
  );
}
const workspaceItems = computed(() => [
  ...[
    { id: "orbit", name: "Orbit" },
    { id: "sandbox", name: "Orbit Sandbox" },
  ].map((item) => ({
    label: item.name,
    icon: tracker.state.value.workspaceId === item.id ? "i-lucide-check" : "i-lucide-orbit",
    onSelect: () => {
      searchOpen.value = false;
      void tracker.switchWorkspace(item.id);
    },
  })),
  { label: "Workspace information", icon: "i-lucide-info", onSelect: workspaceInformation },
]);
const userItems = [
  [
    {
      label: "Reset filters",
      icon: "i-lucide-list-filter",
      onSelect: () => tracker.resetFilters(),
    },
    {
      label: "About this workspace",
      icon: "i-lucide-info",
      onSelect: workspaceInformation,
    },
  ],
];
const mobileItems = computed(() => [
  workspaceItems.value,
  navigation.map((item) => ({
    label: item.label,
    icon: item.icon,
    onSelect: () => tracker.navigate(item.view),
  })),
  userItems[0] ?? [],
]);
const results = computed(() => {
  const query = search.value.trim().toLowerCase();
  const destinations = navigation
    .filter((item) => !query || item.label.toLowerCase().includes(query))
    .map((item) => ({
      key: item.view,
      label: item.label,
      detail: "Navigation",
      icon: item.icon,
      run: () => tracker.navigate(item.view),
    }));
  const issues = ((tracker.state.value.allIssues as Issue[] | undefined) ?? [])
    .filter(
      (issue) =>
        !query || `${issue.id} ${issue.title} ${issue.description}`.toLowerCase().includes(query),
    )
    .slice(0, 12)
    .map((issue) => ({
      key: issue.id,
      label: issue.title,
      detail: issue.id,
      icon: "i-lucide-circle-dashed",
      run: () => tracker.openIssue(issue.id),
    }));
  return [...destinations, ...issues];
});
watch(search, () => {
  activeResult.value = 0;
});
watch(searchOpen, (open) => {
  if (open) {
    search.value = "";
    activeResult.value = 0;
  }
});
watch(results, (items) => {
  activeResult.value = Math.min(activeResult.value, Math.max(0, items.length - 1));
});
function chooseResult(index: number) {
  const result = results.value[index];
  if (!result) return;
  searchOpen.value = false;
  void result.run();
}
function searchKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const count = results.value.length;
    if (count)
      activeResult.value =
        (activeResult.value + (event.key === "ArrowDown" ? 1 : -1) + count) % count;
    nextTick(() =>
      document
        .getElementById(`orbit-result-${activeResult.value}`)
        ?.scrollIntoView({ block: "nearest" }),
    );
  } else if (event.key === "Enter") {
    event.preventDefault();
    chooseResult(activeResult.value);
  }
}
function shortcut(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (!tracker.newIssueOpen.value) searchOpen.value = !searchOpen.value;
  }
}
onMounted(() => window.addEventListener("keydown", shortcut));
onBeforeUnmount(() => window.removeEventListener("keydown", shortcut));
function newIssue() {
  searchOpen.value = false;
  tracker.newIssueOpen.value = true;
}
</script>

<template>
  <div class="orbit-shell dark">
    <a class="skip-link" href="#orbit-main">Skip to content</a>
    <aside class="sidebar" aria-label="Workspace sidebar">
      <div class="workspace-row">
        <UDropdownMenu :items="workspaceItems" :content="{ align: 'start' }">
          <UButton
            variant="ghost"
            color="neutral"
            class="workspace-trigger"
            aria-label="Switch workspace"
          >
            <span class="workspace-mark"><UIcon name="i-lucide-orbit" /></span>
            <span>{{ workspace }}</span
            ><UIcon name="i-lucide-chevrons-up-down" class="workspace-chevron" />
          </UButton>
        </UDropdownMenu>
        <UButton
          icon="i-lucide-square-pen"
          variant="ghost"
          color="neutral"
          aria-label="Create new issue"
          @click="newIssue"
        />
      </div>
      <UButton
        icon="i-lucide-search"
        variant="ghost"
        color="neutral"
        class="search-trigger"
        @click="searchOpen = true"
      >
        <span>Search</span><kbd>⌘ K</kbd>
      </UButton>
      <nav class="primary-nav" aria-label="Workspace">
        <UButton
          v-for="item in navigation"
          :key="item.view"
          :icon="item.icon"
          variant="ghost"
          color="neutral"
          :class="[
            'nav-item',
            { selected: tracker.state.value.view === item.view && !activeProject },
          ]"
          :aria-current="
            tracker.state.value.view === item.view && !activeProject ? 'page' : undefined
          "
          @click="tracker.navigate(item.view)"
          >{{ item.label }}</UButton
        >
      </nav>
      <div class="teams">
        <p class="section-label">Your teams</p>
        <div
          v-for="team in [
            { name: 'Engineering', icon: 'i-lucide-command', view: 'issues' },
            { name: 'Product', icon: 'i-lucide-diamond', view: 'projects' },
          ]"
          :key="team.name"
          class="team-group"
        >
          <UButton
            :icon="team.icon"
            variant="ghost"
            color="neutral"
            class="nav-item team-name"
            @click="tracker.navigate(team.view)"
          >
            {{ team.name }}<UIcon name="i-lucide-chevron-down" class="team-chevron" />
          </UButton>
          <UButton
            :icon="team.view === 'issues' ? 'i-lucide-layers-2' : 'i-lucide-box'"
            variant="ghost"
            color="neutral"
            class="nav-item team-child"
            @click="tracker.navigate(team.view)"
          >
            {{ team.view === "issues" ? "All issues" : "Projects" }}
          </UButton>
          <UButton
            v-for="project in tracker.state.value.projects.filter(
              (project) => project.team === team.name,
            )"
            :key="project.id"
            :icon="project.icon"
            variant="ghost"
            color="neutral"
            :class="[
              'nav-item team-child project-link',
              { selected: activeProject?.id === project.id },
            ]"
            :aria-current="activeProject?.id === project.id ? 'page' : undefined"
            @click="tracker.navigate('issues', project.id)"
          >
            <span>{{ project.name }}</span>
          </UButton>
        </div>
      </div>
      <div class="sidebar-bottom">
        <div class="workspace-info">
          <span class="online-dot" /><span>Small team. Big things.</span
          ><span class="info-caption">Local demo workspace</span>
        </div>
        <UDropdownMenu :items="userItems" :content="{ align: 'start' }">
          <UButton
            variant="ghost"
            color="neutral"
            class="user-trigger"
            aria-label="Alex Morgan account menu"
          >
            <UAvatar alt="Alex Morgan" text="AM" size="xs" class="user-avatar" />
            <span class="user-copy">Alex Morgan<span>Personal workspace</span></span>
            <UIcon name="i-lucide-chevrons-up-down" />
          </UButton>
        </UDropdownMenu>
      </div>
    </aside>
    <div class="main-pane">
      <header class="topbar">
        <div class="mobile-control">
          <UDropdownMenu :items="mobileItems">
            <UButton
              icon="i-lucide-menu"
              variant="ghost"
              color="neutral"
              aria-label="Open workspace and navigation menu"
            />
          </UDropdownMenu>
        </div>
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <span class="breadcrumb-workspace">{{ workspace }}</span
          ><span class="breadcrumb-workspace divider">/</span>
          <span class="breadcrumb-heading">{{ heading }}</span>
          <template v-if="activeProject"
            ><span class="divider">/</span
            ><span class="project-crumb">{{ activeProject.name }}</span></template
          >
        </nav>
        <div class="topbar-actions">
          <UButton
            icon="i-lucide-search"
            variant="ghost"
            color="neutral"
            aria-label="Search workspace (Command or Control K)"
            @click="searchOpen = true"
          />
          <UButton
            icon="i-lucide-plus"
            color="neutral"
            variant="soft"
            size="sm"
            class="create-button"
            aria-label="Create new issue"
            @click="newIssue"
            ><span>New issue</span></UButton
          >
        </div>
      </header>
      <main id="orbit-main" tabindex="-1" class="main-content"><slot /></main>
    </div>
    <UModal
      v-model:open="searchOpen"
      title="Search workspace"
      description="Find any issue in Orbit or jump to a page."
      class="dark"
      :ui="{
        content:
          'bg-[#171719] ring-1 ring-white/10 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain',
        body: 'p-0 overscroll-contain',
        header: 'border-white/5',
        description: 'text-[#9c9ca8]',
        close:
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a78bfa]',
      }"
    >
      <template #body>
        <div class="command-search">
          <UInput
            v-model="search"
            autofocus
            icon="i-lucide-search"
            placeholder="Search issues or jump to…"
            aria-label="Search issues and navigation"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls="orbit-search-results"
            :aria-activedescendant="results.length ? `orbit-result-${activeResult}` : undefined"
            class="command-input"
            @keydown="searchKeydown"
          />
          <div
            id="orbit-search-results"
            role="listbox"
            aria-label="Search results"
            class="command-results"
          >
            <button
              v-for="(result, index) in results"
              :id="`orbit-result-${index}`"
              :key="result.key"
              type="button"
              role="option"
              :aria-selected="index === activeResult"
              :class="['command-result', { active: index === activeResult }]"
              @pointermove="activeResult = index"
              @click="chooseResult(index)"
            >
              <UIcon :name="result.icon" /><span class="result-copy"
                >{{ result.label }}<small>{{ result.detail }}</small></span
              ><UIcon v-if="index === activeResult" name="i-lucide-corner-down-left" />
            </button>
            <p v-if="!results.length" class="empty-search" role="status">
              No matching issues or pages. Try a different title or issue ID.
            </p>
          </div>
          <div class="command-footer">
            <span>↑ ↓ to navigate · Enter to open</span><span>Esc to close</span>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.orbit-shell {
  --shell-border: #ffffff0d;
  display: flex;
  min-height: 100dvh;
  background: #171719;
  color: #e5e5e9;
  font-size: 13px;
}
.orbit-shell :deep(:focus-visible),
.command-search :deep(:focus-visible) {
  outline: 2px solid #a78bfa;
  outline-offset: 2px;
}
.sidebar {
  width: 228px;
  flex: 0 0 228px;
  background: #111113;
  border-right: 1px solid var(--shell-border);
  padding: 15px 12px 10px;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100dvh;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.workspace-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  margin-bottom: 15px;
}
.workspace-trigger {
  min-width: 0;
  font-weight: 650;
  gap: 9px;
  padding: 4px;
  color: #efeff2;
}
.workspace-mark {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background: #6962d5;
  color: white;
  font-size: 19px;
}
.workspace-chevron {
  color: #9c9ca8;
  font-size: 13px;
}
.search-trigger {
  width: 100%;
  color: #9c9ca8;
  font-size: 13px;
  margin-bottom: 12px;
}
kbd {
  margin-left: auto;
  font: inherit;
  font-size: 10px;
  color: #9c9ca8;
  border: 1px solid #ffffff12;
  border-radius: 4px;
  padding: 1px 4px;
}
.primary-nav {
  display: grid;
  gap: 3px;
}
.nav-item {
  width: 100%;
  justify-content: flex-start;
  color: #a5a5af;
  font-size: 13px;
  min-height: 33px;
  gap: 10px;
  border-radius: 6px;
}
@media (hover: hover) {
  .nav-item:hover,
  .search-trigger:hover {
    background: #ffffff06;
    color: #eeeef2;
  }
}
.nav-item.selected {
  background: #ffffff09;
  color: #f0f0f4;
}
.teams {
  margin-top: 30px;
}
.section-label {
  font-size: 11px;
  color: #9c9ca8;
  padding: 0 9px;
  margin-bottom: 11px;
  font-weight: 500;
}
.team-group {
  margin-bottom: 17px;
}
.team-name {
  color: #c5c5ce;
  font-weight: 500;
}
.team-chevron {
  margin-left: auto;
  color: #9c9ca8;
  font-size: 12px;
}
.team-child {
  padding-left: 27px;
  font-size: 12px;
}
.project-link span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sidebar-bottom {
  margin-top: auto;
  padding-top: 35px;
}
.workspace-info {
  display: grid;
  grid-template-columns: 6px 1fr;
  column-gap: 8px;
  row-gap: 4px;
  padding: 12px 9px 18px;
  color: #9c9ca8;
  font-size: 11px;
}
.online-dot {
  width: 5px;
  height: 5px;
  margin-top: 5px;
  background: #827abf;
  border-radius: 50%;
}
.info-caption {
  grid-column: 2;
  color: #9c9ca8;
  font-size: 10px;
}
.user-trigger {
  width: 100%;
  border-top: 1px solid var(--shell-border);
  border-radius: 0;
  padding: 12px 4px 3px;
  color: #9c9ca8;
  gap: 9px;
}
.user-avatar {
  background: #393049;
  color: #d9c7f0;
}
.user-copy {
  text-align: left;
  flex: 1;
  color: #c5c5ce;
  font-size: 12px;
}
.user-copy span {
  display: block;
  color: #9c9ca8;
  font-size: 10px;
  margin-top: 2px;
}
.main-pane {
  min-width: 0;
  flex: 1;
}
.topbar {
  height: 57px;
  border-bottom: 1px solid var(--shell-border);
  display: flex;
  align-items: center;
  padding: 0 25px;
  gap: 12px;
}
.breadcrumb {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
}
.breadcrumb-workspace {
  color: #9c9ca8;
}
.breadcrumb-heading {
  margin: 0;
  font-size: 13px;
  font-weight: 550;
  white-space: nowrap;
}
.divider {
  color: #9c9ca8;
}
.project-crumb {
  color: #a3a3ae;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.topbar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.create-button {
  background: #ffffff08;
  border: 1px solid #ffffff0d;
  color: #d4d4dd;
  font-size: 12px;
}
.main-content {
  min-width: 0;
  outline: none;
}
.mobile-control {
  display: none;
}
.skip-link {
  position: fixed;
  left: 12px;
  top: -60px;
  z-index: 100;
  background: #6962d5;
  padding: 10px 16px;
  border-radius: 6px;
  color: white;
}
.skip-link:focus {
  top: 12px;
}
.command-search {
  background: #171719;
}
.command-input {
  display: flex;
  margin: 14px;
}
.command-input :deep(input) {
  width: 100%;
  background: #111113;
}
.command-results {
  max-height: min(390px, 50dvh);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 8px 8px;
}
.command-result {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  padding: 10px;
  color: #9c9ca8;
  text-align: left;
  border-radius: 6px;
  cursor: pointer;
}
.command-result.active,
.command-result:focus-visible {
  background: #ffffff08;
  color: #f0f0f5;
}
.result-copy {
  flex: 1;
  min-width: 0;
  font-size: 13px;
}
.result-copy small {
  display: block;
  margin-top: 3px;
  color: #9c9ca8;
  font-size: 11px;
}
.command-footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid #ffffff0d;
  padding: 12px 16px;
  color: #9c9ca8;
  font-size: 10px;
}
.empty-search {
  padding: 28px 16px;
  text-align: center;
  color: #9c9ca8;
  font-size: 13px;
}
@media (max-width: 767px) {
  .sidebar {
    display: none;
  }
  .mobile-control {
    display: inline-flex;
  }
  .topbar {
    padding: 0 12px;
    gap: 8px;
  }
  .breadcrumb {
    gap: 8px;
  }
  .breadcrumb-workspace {
    display: none;
  }
  .topbar-actions {
    gap: 4px;
  }
}
@media (max-width: 420px) {
  .create-button span {
    display: none;
  }
  .topbar {
    padding: 0 8px;
    gap: 6px;
  }
  .breadcrumb {
    flex: 1;
    overflow: hidden;
    gap: 5px;
  }
  .breadcrumb-heading {
    flex-shrink: 0;
    font-size: 12px;
  }
  .project-crumb {
    min-width: 0;
    max-width: 95px;
  }
  .command-footer {
    flex-wrap: wrap;
    gap: 6px;
    font-size: 10px;
  }
  .result-copy {
    overflow-wrap: anywhere;
  }
}
</style>
