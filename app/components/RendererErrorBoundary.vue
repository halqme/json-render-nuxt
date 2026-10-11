<script setup lang="ts">
const emit = defineEmits<{ error: [error: unknown] }>();

onErrorCaptured((error) => {
  emit("error", error);
  return false;
});
</script>

<template>
  <slot />
</template>
