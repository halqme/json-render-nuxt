<script setup lang="ts">
import type { Issue } from "../../../shared/types";
defineProps<{ issue: Issue }>();
</script>

<template>
  <header class="jr-issue-heading">
    <div class="jr-issue-kicker">
      <UIcon name="i-lucide-command" class="jr-icon" />
      {{ issue.id }}
      <span>Engineering</span>
    </div>
    <h1>{{ issue.title }}</h1>
    <div class="jr-labels">
      <UBadge
        v-for="label in issue.labels"
        :key="label"
        :label="label"
        color="neutral"
        variant="subtle"
        size="sm"
      />
    </div>
  </header>
</template>
