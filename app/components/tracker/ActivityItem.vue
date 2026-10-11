<script setup lang="ts">
import type { Activity, Person } from "../../../shared/types";

const props = defineProps<{ activity: Activity; people: Person[] }>();
const author = computed(() => props.people.find((person) => person.id === props.activity.author));
function relativeDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}
</script>

<template>
  <article class="jr-activity-item" :class="`jr-activity-${activity.type}`">
    <UAvatar :alt="author?.name ?? 'Teammate'" :text="author?.initials ?? '??'" size="sm" />
    <div class="jr-activity-content">
      <div class="jr-activity-meta">
        <strong>{{ author?.name ?? "Teammate" }}</strong>
        <time :datetime="activity.createdAt">{{ relativeDate(activity.createdAt) }}</time>
      </div>
      <p>{{ activity.text }}</p>
    </div>
  </article>
</template>
