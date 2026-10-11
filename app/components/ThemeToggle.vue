<script setup lang="ts">
const colorMode = useColorMode();
const isDark = computed(() => colorMode.value === "dark");
const label = computed(() => (isDark.value ? "Switch to light mode" : "Switch to dark mode"));
</script>

<template>
  <UButton
    :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'"
    variant="ghost"
    color="neutral"
    :aria-label="label"
    :title="label"
    @click="colorMode.preference = isDark ? 'light' : 'dark'"
  />
</template>
