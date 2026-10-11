<script setup lang="ts">
import type { Person, Project } from "../../../shared/types";

const props = defineProps<{ project: Project & { issueCount: number }; people: Person[] }>();
const emit = defineEmits<{ open: [] }>();
const lead = computed(() => props.people.find((person) => person.id === props.project.lead));
function relativeDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}
</script>

<template>
  <article class="jr-project-card">
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
      @click="emit('open')"
    >
      <h2>{{ project.name }}</h2>
      <UIcon name="i-lucide-arrow-up-right" class="jr-icon" />
    </button>
    <p class="jr-project-description">{{ project.description }}</p>
    <div class="jr-project-team">
      <UIcon name="i-lucide-users" class="jr-icon" />
      {{ project.team }}
      <span class="jr-project-lead">
        <UAvatar :alt="lead?.name ?? 'Project lead'" :text="lead?.initials" size="xs" />
      </span>
    </div>
    <div class="jr-progress">
      <div class="jr-progress-label">
        <span>Milestone progress</span><span>{{ project.progress }}%</span>
      </div>
      <UProgress :model-value="project.progress" :max="100" size="xs" color="primary" />
    </div>
    <div class="jr-project-footer">
      <button type="button" @click="emit('open')">{{ project.issueCount }} issues</button>
      <span
        ><UIcon name="i-lucide-calendar-days" class="jr-icon" />{{
          relativeDate(project.targetDate)
        }}</span
      >
    </div>
  </article>
</template>
