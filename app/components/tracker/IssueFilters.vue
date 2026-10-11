<script setup lang="ts">
type Option = { label: string; value: string };
defineProps<{
  query: string;
  statusFilter: string;
  priorityFilter: string;
  assigneeFilter: string;
  tab: string;
  statuses: Option[];
  priorities: Option[];
  assignees: Option[];
}>();
const emit = defineEmits<{
  "update:query": [value: string];
  "update:statusFilter": [value: string];
  "update:priorityFilter": [value: string];
  "update:assigneeFilter": [value: string];
  "update:tab": [value: string];
  reset: [];
}>();
const tabs = [
  { label: "All issues", value: "all" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "done" },
] as const;
</script>

<template>
  <div>
    <div class="jr-tabs" role="group" aria-label="Issue scope">
      <button
        v-for="item in tabs"
        :key="item.value"
        type="button"
        :class="['jr-tab', { active: tab === item.value }]"
        :aria-pressed="tab === item.value"
        @click="emit('update:tab', item.value)"
      >
        {{ item.label }}
      </button>
    </div>
    <section class="jr-toolbar" role="search" aria-label="Filter issues">
      <UInput
        :model-value="query"
        aria-label="Search issues"
        placeholder="Search issues…"
        icon="i-lucide-search"
        class="jr-search"
        color="neutral"
        @update:model-value="emit('update:query', $event)"
      />
      <USelect
        :model-value="statusFilter || 'all'"
        :items="statuses"
        aria-label="Status"
        class="jr-filter"
        color="neutral"
        @update:model-value="emit('update:statusFilter', $event)"
      />
      <USelect
        :model-value="priorityFilter || 'all'"
        :items="priorities"
        aria-label="Priority"
        class="jr-filter"
        color="neutral"
        @update:model-value="emit('update:priorityFilter', $event)"
      />
      <USelect
        :model-value="assigneeFilter || 'all'"
        :items="assignees"
        aria-label="Assignee"
        class="jr-filter"
        color="neutral"
        @update:model-value="emit('update:assigneeFilter', $event)"
      />
      <UButton
        label="Reset"
        icon="i-lucide-rotate-ccw"
        color="neutral"
        variant="ghost"
        @click="emit('reset')"
      />
    </section>
  </div>
</template>
