<script setup lang="ts">
defineProps<{ modelValue: string }>();
const emit = defineEmits<{ "update:modelValue": [value: string]; post: [] }>();
</script>

<template>
  <section class="jr-section-comment">
    <h2 class="jr-section-title">Add a comment</h2>
    <UTextarea
      :model-value="modelValue"
      aria-label="Comment"
      placeholder="Share an update or ask a question…"
      :rows="3"
      autoresize
      class="jr-comment-input"
      color="neutral"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <UButton
      label="Post comment"
      icon="i-lucide-arrow-up"
      color="primary"
      class="jr-button"
      @click="emit('post')"
    />
  </section>
</template>
