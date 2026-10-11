<script setup lang="ts">
import type { IssueStatus } from "../../../shared/types";

defineProps<{ status: IssueStatus; count: number }>();
const statusIcons: Record<IssueStatus, string> = {
  Backlog: "i-lucide-circle-dashed",
  Todo: "i-lucide-circle",
  "In progress": "i-lucide-circle-dot",
  "In review": "i-lucide-circle-ellipsis",
  Done: "i-lucide-circle-check",
};
</script>

<template>
  <section class="jr-issue-group" :aria-label="status">
    <div class="jr-group-heading">
      <UIcon
        :name="statusIcons[status]"
        class="jr-icon"
        :class="`status-${status.toLowerCase().replaceAll(' ', '-')}`"
      />
      <h2>{{ status }}</h2>
      <span class="jr-group-count">{{ count }}</span>
    </div>
    <slot />
  </section>
</template>
