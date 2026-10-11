<script setup lang="ts">
defineProps<{ label: string; icon: string; primary?: boolean }>();
const emit = defineEmits<{ press: [] }>();
</script>

<template>
  <UButton
    :label="label"
    :icon="icon"
    color="primary"
    :variant="primary ? 'solid' : 'outline'"
    @click="emit('press')"
  />
</template>
