<script setup lang="ts">
import type { Project } from "../../../shared/types";

const props = defineProps<{
  view: string;
  count: number;
  projectFilter: string;
  projects: Project[];
}>();
const isMine = computed(() => props.view === "my-issues");
const isProjects = computed(() => props.view === "projects");
const title = computed(() =>
  isProjects.value ? "Projects" : isMine.value ? "My issues" : "All issues",
);
const subtitle = computed(() => {
  if (isProjects.value) return "The bigger picture, one milestone at a time.";
  if (isMine.value) return "Your work, with a little more focus.";
  return (
    props.projects.find((project) => project.id === props.projectFilter)?.name ??
    "Everything your team is moving forward."
  );
});
</script>

<template>
  <header class="jr-page-header">
    <div class="jr-page-heading">
      <div class="jr-title-line">
        <UIcon
          :name="
            isProjects
              ? 'i-lucide-box'
              : isMine
                ? 'i-lucide-circle-user-round'
                : 'i-lucide-layers-2'
          "
          class="jr-heading-icon"
        />
        <h1>{{ title }}</h1>
        <span class="jr-count">{{ count }}</span>
      </div>
      <p>{{ subtitle }}</p>
    </div>
    <div class="jr-header-actions"><slot /></div>
  </header>
</template>
