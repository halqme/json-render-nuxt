<script setup lang="ts">
import type { Spec } from "@json-render/core";
import { ZodError } from "zod";
import { validateViewSpec } from "../../shared/validate-view";

const props = defineProps<{
  spec: Spec | null;
  viewName: string;
  modified: boolean;
  loading: boolean;
}>();
const emit = defineEmits<{ apply: [spec: Spec]; reset: []; close: [] }>();
const draft = ref("");
const error = ref("");
const feedback = ref("");
watch(
  () => [props.viewName, props.spec],
  () => {
    draft.value = props.spec ? JSON.stringify(props.spec, null, 2) : "";
    error.value = "";
    feedback.value = "";
  },
  { immediate: true },
);
watch(draft, () => {
  error.value = "";
  feedback.value = "";
});

function apply() {
  if (!props.spec || props.loading) return;
  try {
    const input: unknown = JSON.parse(draft.value);
    const spec = validateViewSpec(input);
    emit("apply", spec);
    nextTick(() => {
      feedback.value = "Applied to this view. Server spec unchanged.";
    });
  } catch (cause) {
    error.value =
      cause instanceof ZodError
        ? cause.issues
            .slice(0, 3)
            .map((issue) => `${issue.path.join(".") || "spec"}: ${issue.message}`)
            .join("\n")
        : cause instanceof Error
          ? cause.message
          : "Invalid UI spec. Check the JSON and try again.";
  }
}
async function reset() {
  emit("reset");
  await nextTick();
  draft.value = props.spec ? JSON.stringify(props.spec, null, 2) : "";
  error.value = "";
  await nextTick();
  feedback.value = "Restored the server spec.";
}
function shortcut(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    apply();
  }
}
</script>

<template>
  <aside class="spec-inspector" aria-labelledby="inspector-title">
    <header class="inspector-header">
      <div>
        <h2 id="inspector-title"><UIcon name="i-lucide-code-xml" />Inspect UI</h2>
        <p>{{ viewName }}</p>
      </div>
      <UButton
        icon="i-lucide-x"
        variant="ghost"
        color="neutral"
        aria-label="Close Inspect UI"
        @click="emit('close')"
      />
    </header>
    <div class="inspector-description">
      <UBadge
        :label="modified ? 'Client override' : 'Server spec'"
        :color="modified ? 'primary' : 'neutral'"
        variant="subtle"
        size="sm"
      />
      <p>
        Edit this view's JSON and Apply to preview it instantly. Changes stay in memory until
        reload.
      </p>
    </div>
    <label for="ui-spec-json" class="editor-label">UI Spec JSON</label>
    <textarea
      id="ui-spec-json"
      v-model="draft"
      class="spec-editor"
      spellcheck="false"
      autocapitalize="off"
      autocomplete="off"
      wrap="off"
      :disabled="!spec || loading"
      :aria-invalid="!!error"
      :aria-describedby="error ? 'spec-error' : 'spec-editor-hint'"
      @keydown="shortcut"
    />
    <p id="spec-editor-hint" class="editor-hint">
      ⌘ / Ctrl + Enter to apply · Closing or navigating discards drafts
    </p>
    <p v-if="error" id="spec-error" class="inspector-error" role="alert">{{ error }}</p>
    <p v-if="feedback" class="inspector-feedback" role="status">{{ feedback }}</p>
    <footer class="inspector-actions">
      <UButton
        label="Restore server spec"
        icon="i-lucide-rotate-ccw"
        color="neutral"
        variant="outline"
        size="sm"
        :disabled="!spec || loading"
        @click="reset"
      />
      <UButton
        label="Apply"
        icon="i-lucide-check"
        size="sm"
        :disabled="!spec || loading"
        @click="apply"
      />
    </footer>
  </aside>
</template>

<style scoped>
.spec-inspector {
  position: sticky;
  inset-block-start: 0;
  height: calc(100dvh - 57px);
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-inline-start: 1px solid #343439;
  background: #141416;
  padding: 18px;
  gap: 12px;
}
.inspector-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.inspector-header h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
}
.inspector-header p {
  color: #aaaab7;
  font-family: monospace;
  font-size: 11px;
  margin-block-start: 6px;
}
.inspector-description p {
  font-size: 12px;
  color: #aaaab7;
  line-height: 1.7;
  margin-block-start: 8px;
}
.editor-label {
  font-size: 11px;
  font-weight: 500;
  color: #c5c5ce;
}
.spec-editor {
  flex: 1;
  width: 100%;
  min-height: 140px;
  resize: none;
  padding: 12px;
  border: 1px solid #575762;
  border-radius: 6px;
  background: #1b1b1f;
  color: #ddd5f0;
  font:
    12px/1.7 ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
  tab-size: 2;
  overscroll-behavior: contain;
}
.spec-editor:focus-visible {
  outline: 2px solid #a78bfa;
  outline-offset: 2px;
}
.editor-hint {
  font-size: 10px;
  color: #aaaab7;
  line-height: 1.6;
}
.inspector-error {
  max-height: 110px;
  overflow: auto;
  overscroll-behavior: contain;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 11px;
  color: #f3aaaa;
}
.inspector-feedback {
  font-size: 11px;
  color: #bcb1df;
  line-height: 1.6;
}
.inspector-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 10px;
}
@media (max-width: 1000px) {
  .spec-inspector {
    position: static;
    border-inline-start: 0;
    border-block-end: 1px solid #343439;
    height: 65dvh;
    min-height: 480px;
  }
}
</style>
