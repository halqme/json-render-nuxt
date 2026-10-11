<script setup lang="ts">
import type { Issue, Person, Project } from "../../../shared/types";

const props = defineProps<{
  issue: Issue;
  people: Person[];
  projects: Project[];
  selectedIds: string[];
}>();
const emit = defineEmits<{ open: []; toggle: [] }>();
const assigneeTooltip = ref<string | null>(null);
const peopleById = computed(() => new Map(props.people.map((person) => [person.id, person])));
const project = computed(() => props.projects.find((item) => item.id === props.issue.project));
const assignee = computed(() => peopleById.value.get(props.issue.assignee));
const selected = computed(() => props.selectedIds.includes(props.issue.id));
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
function personName(id: string) {
  return peopleById.value.get(id)?.name ?? "Unassigned";
}
function setAssigneeTooltip(issueId: string, open: boolean) {
  if (open) assigneeTooltip.value = issueId;
  else if (assigneeTooltip.value === issueId) assigneeTooltip.value = null;
}
</script>

<template>
  <div class="jr-issue-row" :class="{ 'is-selected': selected }" :data-issue-id="issue.id">
    <input
      type="checkbox"
      class="jr-row-checkbox"
      :checked="selected"
      :aria-label="`Select ${issue.id}`"
      @change="emit('toggle')"
    />
    <button
      type="button"
      class="jr-issue-link"
      :aria-label="`${issue.id}: ${issue.title}`"
      @click="emit('open')"
    >
      <UIcon
        :name="priorityIcons[issue.priority]"
        class="jr-priority"
        :class="`priority-${issue.priority.toLowerCase()}`"
      />
      <span class="jr-issue-id">{{ issue.id }}</span>
      <UIcon
        :name="statusIcons[issue.status]"
        class="jr-icon"
        :class="`status-${issue.status.toLowerCase().replaceAll(' ', '-')}`"
      />
      <span class="jr-issue-title">{{ issue.title }}</span>
      <span class="jr-row-label">{{ issue.labels[0] }}</span>
    </button>
    <span class="jr-row-priority">{{ issue.priority }}</span>
    <span class="jr-row-project">
      <template v-if="project">
        <UIcon :name="project.icon" class="jr-icon" />
        {{ project.name }}
      </template>
      <template v-else>—</template>
    </span>
    <UTooltip
      :text="`Assignee: ${personName(issue.assignee)}`"
      :open="assigneeTooltip === issue.id"
      @update:open="setAssigneeTooltip(issue.id, $event)"
    >
      <button
        type="button"
        class="jr-assignee"
        :aria-label="`Assignee: ${personName(issue.assignee)}`"
        @focus="setAssigneeTooltip(issue.id, true)"
        @blur="setAssigneeTooltip(issue.id, false)"
      >
        <UAvatar
          v-if="assignee"
          :alt="assignee.name"
          :text="assignee.initials"
          size="xs"
          aria-hidden="true"
        />
        <span v-else class="unassigned" aria-hidden="true">
          <UIcon name="i-lucide-user-round" class="jr-icon" />
        </span>
      </button>
    </UTooltip>
  </div>
</template>
