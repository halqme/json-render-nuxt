<script setup lang="ts">
import { priorities, statuses } from "../../shared/types";
import type { Issue } from "../../shared/types";

const tracker = useTracker();
const state = computed(() => tracker.state.value);
const isProjects = computed(() => state.value.view === "projects");
const isMine = computed(() => state.value.view === "my-issues");
const assigneeTooltip = ref<string | null>(null);
const heading = computed(() =>
  isProjects.value ? "Projects" : isMine.value ? "My issues" : "All issues",
);
const selectedIds = computed(() => state.value.selectedIds);
const statusItems = [
  { label: "All statuses", value: "all" },
  ...statuses.map((status) => ({ label: status, value: status })),
];
const priorityItems = [
  { label: "All priorities", value: "all" },
  ...priorities.map((priority) => ({ label: priority, value: priority })),
];
const assigneeItems = computed(() => [
  { label: "All assignees", value: "all" },
  { label: "Unassigned", value: "unassigned" },
  ...state.value.people.map((person) => ({ label: person.name, value: person.id })),
]);
const tabs = [
  { label: "All issues", value: "all" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "done" },
] as const;
const statusIcons: Record<string, string> = {
  Backlog: "i-lucide-circle-dashed",
  Todo: "i-lucide-circle",
  "In progress": "i-lucide-circle-dot",
  "In review": "i-lucide-circle-ellipsis",
  Done: "i-lucide-circle-check",
};
const priorityIcons: Record<string, string> = {
  Urgent: "i-lucide-signal-high",
  High: "i-lucide-signal-high",
  Medium: "i-lucide-signal-medium",
  Low: "i-lucide-signal-low",
};
const peopleById = computed(() => new Map(state.value.people.map((person) => [person.id, person])));
const projectsById = computed(
  () => new Map(state.value.projects.map((project) => [project.id, project])),
);

function toggleSelection(id: string) {
  const ids = selectedIds.value;
  tracker.store.set(
    "/selectedIds",
    ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
  );
}
function personName(id: string) {
  return peopleById.value.get(id)?.name ?? "Unassigned";
}
function projectFor(issueRecord: Issue) {
  return projectsById.value.get(issueRecord.project);
}
function relativeDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}
function setAssigneeTooltip(issueId: string, open: boolean) {
  if (open) assigneeTooltip.value = issueId;
  else if (assigneeTooltip.value === issueId) assigneeTooltip.value = null;
}
</script>

<template>
  <main v-if="isProjects" class="jr-stack jr-stack-page">
    <header class="jr-page-header">
      <div class="jr-page-heading">
        <div class="jr-title-line">
          <UIcon name="i-lucide-box" class="jr-heading-icon" />
          <h1>Projects</h1>
          <span class="jr-count">{{ state.projects.length }}</span>
        </div>
        <p>The bigger picture, one milestone at a time.</p>
      </div>
      <UButton
        label="View all issues"
        icon="i-lucide-arrow-up-right"
        color="neutral"
        variant="outline"
        @click="tracker.navigate('issues')"
      />
    </header>
    <p class="jr-text-eyebrow">WORKSPACE INITIATIVES</p>
    <div class="jr-grid-projects">
      <article v-for="project in state.projects" :key="project.id" class="jr-project-card">
        <div class="jr-project-top">
          <span
            class="jr-project-icon"
            :style="{ color: project.color, background: `${project.color}18` }"
          >
            <UIcon :name="project.icon" class="jr-icon" />
          </span>
          <UBadge :label="project.status" color="neutral" variant="subtle" size="sm" />
        </div>
        <button
          class="jr-project-link"
          type="button"
          :aria-label="`Open ${project.name} issues`"
          @click="tracker.navigate('issues', project.id)"
        >
          <h2>{{ project.name }}</h2>
          <UIcon name="i-lucide-arrow-up-right" class="jr-icon" />
        </button>
        <p class="jr-project-description">{{ project.description }}</p>
        <div class="jr-project-team">
          <UIcon name="i-lucide-users" class="jr-icon" />
          {{ project.team }}
          <span class="jr-project-lead">
            <UAvatar
              :alt="personName(project.lead)"
              :text="peopleById.get(project.lead)?.initials"
              size="xs"
            />
          </span>
        </div>
        <div class="jr-progress">
          <div class="jr-progress-label">
            <span>Milestone progress</span><span>{{ project.progress }}%</span>
          </div>
          <UProgress :model-value="project.progress" :max="100" size="xs" color="primary" />
        </div>
        <div class="jr-project-footer">
          <button type="button" @click="tracker.navigate('issues', project.id)">
            {{ project.issueCount }} issues
          </button>
          <span
            ><UIcon name="i-lucide-calendar-days" class="jr-icon" />{{
              relativeDate(project.targetDate)
            }}</span
          >
        </div>
      </article>
      <p v-if="!state.projects.length" class="jr-text-caption">
        No projects are available to this demo persona.
      </p>
    </div>
    <p class="jr-text-caption">
      Select a project to explore its issues. Progress reflects the current project milestone.
    </p>
  </main>

  <main v-else class="jr-stack jr-stack-page">
    <header class="jr-page-header">
      <div class="jr-page-heading">
        <div class="jr-title-line">
          <UIcon
            :name="isMine ? 'i-lucide-circle-user-round' : 'i-lucide-layers-2'"
            class="jr-heading-icon"
          />
          <h1>{{ heading }}</h1>
          <span class="jr-count">{{ state.totalCount }}</span>
        </div>
        <p>
          {{
            isMine
              ? "Your work, with a little more focus."
              : (state.projects.find((project) => project.id === state.projectFilter)?.name ??
                "Everything your team is moving forward.")
          }}
        </p>
      </div>
      <UButton
        v-if="tracker.canWrite.value"
        label="New issue"
        icon="i-lucide-plus"
        color="primary"
        @click="tracker.newIssueOpen.value = true"
      />
    </header>

    <div class="jr-tabs" role="group" aria-label="Issue scope">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        type="button"
        :class="['jr-tab', { active: state.tab === tab.value }]"
        :aria-pressed="state.tab === tab.value"
        @click="tracker.store.set('/tab', tab.value)"
      >
        {{ tab.label }}
      </button>
    </div>
    <section class="jr-toolbar" role="search" aria-label="Filter issues">
      <UInput
        :model-value="state.query"
        aria-label="Search issues"
        placeholder="Search issues…"
        icon="i-lucide-search"
        class="jr-search"
        color="neutral"
        @update:model-value="tracker.store.set('/query', $event)"
      />
      <USelect
        :model-value="state.statusFilter || 'all'"
        :items="statusItems"
        aria-label="Status"
        class="jr-filter"
        color="neutral"
        @update:model-value="tracker.store.set('/statusFilter', $event === 'all' ? '' : $event)"
      />
      <USelect
        :model-value="state.priorityFilter || 'all'"
        :items="priorityItems"
        aria-label="Priority"
        class="jr-filter"
        color="neutral"
        @update:model-value="tracker.store.set('/priorityFilter', $event === 'all' ? '' : $event)"
      />
      <USelect
        :model-value="state.assigneeFilter || 'all'"
        :items="assigneeItems"
        aria-label="Assignee"
        class="jr-filter"
        color="neutral"
        @update:model-value="tracker.store.set('/assigneeFilter', $event === 'all' ? '' : $event)"
      />
      <UButton
        label="Reset"
        icon="i-lucide-rotate-ccw"
        color="neutral"
        variant="ghost"
        @click="tracker.resetFilters()"
      />
    </section>
    <div class="jr-list-summary">
      <span>
        {{ state.filteredCount }} of {{ state.totalCount }} issues
        <template v-if="selectedIds.length"> · {{ selectedIds.length }} selected</template>
      </span>
      <span class="jr-summary-meta"
        ><UIcon name="i-lucide-list-filter" class="jr-icon" />Grouped by status</span
      >
    </div>
    <section
      v-for="group in state.groups"
      v-show="group.count"
      :key="group.status"
      class="jr-issue-group"
      :aria-label="group.status"
    >
      <div class="jr-group-heading">
        <UIcon
          :name="statusIcons[group.status]"
          class="jr-icon"
          :class="`status-${group.status.toLowerCase().replaceAll(' ', '-')}`"
        />
        <h2>{{ group.status }}</h2>
        <span class="jr-group-count">{{ group.count }}</span>
      </div>
      <div
        v-for="issueRecord in group.issues"
        :key="issueRecord.id"
        class="jr-issue-row"
        :class="{ 'is-selected': selectedIds.includes(issueRecord.id) }"
        :data-issue-id="issueRecord.id"
      >
        <input
          type="checkbox"
          class="jr-row-checkbox"
          :checked="selectedIds.includes(issueRecord.id)"
          :aria-label="`Select ${issueRecord.id}`"
          @change="toggleSelection(issueRecord.id)"
        />
        <button
          type="button"
          class="jr-issue-link"
          :aria-label="`${issueRecord.id}: ${issueRecord.title}`"
          @click="tracker.openIssue(issueRecord.id)"
        >
          <UIcon
            :name="priorityIcons[issueRecord.priority]"
            class="jr-priority"
            :class="`priority-${issueRecord.priority.toLowerCase()}`"
          />
          <span class="jr-issue-id">{{ issueRecord.id }}</span>
          <UIcon
            :name="statusIcons[issueRecord.status]"
            class="jr-icon"
            :class="`status-${issueRecord.status.toLowerCase().replaceAll(' ', '-')}`"
          />
          <span class="jr-issue-title">{{ issueRecord.title }}</span>
          <span class="jr-row-label">{{ issueRecord.labels[0] }}</span>
        </button>
        <span class="jr-row-priority">{{ issueRecord.priority }}</span>
        <span class="jr-row-project">
          <template v-if="projectFor(issueRecord)">
            <UIcon :name="projectFor(issueRecord)!.icon" class="jr-icon" />
            {{ projectFor(issueRecord)!.name }}
          </template>
          <template v-else>—</template>
        </span>
        <UTooltip
          :text="`Assignee: ${personName(issueRecord.assignee)}`"
          :open="assigneeTooltip === issueRecord.id"
          @update:open="setAssigneeTooltip(issueRecord.id, $event)"
        >
          <button
            type="button"
            class="jr-assignee"
            :aria-label="`Assignee: ${personName(issueRecord.assignee)}`"
            @focus="setAssigneeTooltip(issueRecord.id, true)"
            @blur="setAssigneeTooltip(issueRecord.id, false)"
          >
            <UAvatar
              v-if="issueRecord.assignee"
              :alt="personName(issueRecord.assignee)"
              :text="peopleById.get(issueRecord.assignee)?.initials"
              size="xs"
              aria-hidden="true"
            />
            <span v-else class="unassigned" aria-hidden="true">
              <UIcon name="i-lucide-user-round" class="jr-icon" />
            </span>
          </button>
        </UTooltip>
      </div>
    </section>
    <section v-if="state.filteredCount === 0" class="jr-empty" role="status">
      <UIcon name="i-lucide-search-x" class="jr-icon" />
      <h2>No issues found</h2>
      <p>Try a different search or reset your filters to see more work.</p>
      <UButton
        label="Reset filters"
        color="neutral"
        variant="outline"
        @click="tracker.resetFilters()"
      />
    </section>
  </main>
</template>
