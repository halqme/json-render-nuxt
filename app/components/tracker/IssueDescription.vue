<script setup lang="ts">
defineProps<{ description: string }>();
</script>

<template>
  <section class="jr-section-description">
    <h2 class="jr-section-title">Description</h2>
    <p class="jr-text-body">{{ description || "No description provided." }}</p>
  </section>
</template>
