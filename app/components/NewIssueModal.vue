<script setup lang="ts">
import { people, projects } from "../../shared/mock-data";
import { priorities, statuses } from "../../shared/types";
import type { IssuePriority, IssueStatus } from "../../shared/types";

const tracker = useTracker();
const open = tracker.newIssueOpen;
const title = ref("");
const description = ref("");
const status = ref<IssueStatus>("Todo");
const priority = ref<IssuePriority>("Medium");
const assignee = ref("alex");
const project = ref("none");
const error = ref("");
const submitting = ref(false);
const titleInput = ref<{ inputRef?: HTMLInputElement } | null>(null);
const assigneeItems = [
  { label: "Unassigned", value: "none" },
  ...people.map((person) => ({ label: person.name, value: person.id })),
];
const projectItems = [
  { label: "No project", value: "none" },
  ...projects.map((item) => ({ label: item.name, value: item.id })),
];
const selectedPerson = computed(() => people.find((person) => person.id === assignee.value));
watch(
  open,
  (value) => {
    if (!value) return;
    title.value = "";
    description.value = "";
    status.value = "Todo";
    priority.value = "Medium";
    assignee.value = "alex";
    project.value = projects.some((item) => item.id === tracker.state.value.projectFilter)
      ? tracker.state.value.projectFilter
      : "none";
    error.value = "";
  },
  { immediate: true },
);
watch(title, () => {
  error.value = "";
});
function submit() {
  if (submitting.value) return;
  if (!title.value.trim()) {
    error.value = "Give your issue a title before creating it.";
    titleInput.value?.inputRef?.focus();
    return;
  }
  submitting.value = true;
  try {
    const issue = tracker.createIssue({
      title: title.value.trim(),
      description: description.value.trim(),
      status: status.value,
      priority: priority.value,
      assignee: assignee.value === "none" ? "" : assignee.value,
      project: project.value === "none" ? "" : project.value,
    });
    if (!issue)
      error.value =
        "This issue could not be created. Check the title and properties, then try again.";
  } catch {
    error.value = "Something went wrong. Your draft is still here; please try again.";
  } finally {
    submitting.value = false;
  }
}
function submitShortcut(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    submit();
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="New issue"
    description="Capture a task for your team. Add details and choose its properties."
    :ui="{
      content:
        'bg-default ring-1 ring-default sm:max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain',
      body: 'p-0 overscroll-contain',
      header: 'border-default',
      description: 'text-muted',
      close:
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--orbit-focus)',
    }"
  >
    <template #body>
      <form class="issue-form" @submit.prevent="submit" @keydown="submitShortcut">
        <div class="issue-context">
          <span class="team-badge"><UIcon name="i-lucide-command" /> ENG</span
          ><UIcon name="i-lucide-chevron-right" /><span>New issue</span>
        </div>
        <div class="draft-fields">
          <label for="orbit-issue-title" class="sr-only">Issue title (required)</label>
          <UInput
            id="orbit-issue-title"
            ref="titleInput"
            v-model="title"
            autofocus
            placeholder="Issue title"
            required
            aria-required="true"
            :aria-invalid="!!error"
            :aria-describedby="error ? 'orbit-issue-error' : undefined"
            variant="none"
            class="title-input"
            :ui="{ base: 'text-lg font-medium px-0 py-2 bg-transparent ring-0' }"
          />
          <label for="orbit-issue-description" class="sr-only">Description</label>
          <UTextarea
            id="orbit-issue-description"
            v-model="description"
            placeholder="Add a description…"
            :rows="4"
            autoresize
            variant="none"
            class="description-input"
            :ui="{ base: 'px-0 py-2 bg-transparent ring-0 resize-none text-sm' }"
          />
        </div>
        <div class="issue-properties">
          <div class="property-field">
            <label for="orbit-issue-status"><UIcon name="i-lucide-circle-dashed" />Status</label>
            <USelect
              id="orbit-issue-status"
              v-model="status"
              :items="[...statuses]"
              aria-label="Issue status"
              color="neutral"
              class="property-select"
            />
          </div>
          <div class="property-field">
            <label for="orbit-issue-priority"><UIcon name="i-lucide-signal" />Priority</label>
            <USelect
              id="orbit-issue-priority"
              v-model="priority"
              :items="[...priorities]"
              aria-label="Issue priority"
              color="neutral"
              class="property-select"
            />
          </div>
          <div class="property-field">
            <label for="orbit-issue-assignee"><UIcon name="i-lucide-user-round" />Assignee</label>
            <USelect
              id="orbit-issue-assignee"
              v-model="assignee"
              :items="assigneeItems"
              aria-label="Issue assignee"
              color="neutral"
              class="property-select"
            >
              <template #leading
                ><UAvatar
                  v-if="selectedPerson"
                  :alt="selectedPerson.name"
                  :text="selectedPerson.initials"
                  size="3xs"
                  :style="{
                    backgroundColor: selectedPerson.color + '30',
                  }" /><UIcon v-else name="i-lucide-user-round"
              /></template>
            </USelect>
          </div>
          <div class="property-field">
            <label for="orbit-issue-project"><UIcon name="i-lucide-box" />Project</label>
            <USelect
              id="orbit-issue-project"
              v-model="project"
              :items="projectItems"
              aria-label="Issue project"
              color="neutral"
              class="property-select"
            />
          </div>
        </div>
        <p v-if="error" id="orbit-issue-error" role="alert" class="form-error">{{ error }}</p>
        <footer class="form-footer">
          <span class="shortcut-hint">⌘ / Ctrl + Enter to create</span>
          <div class="form-actions">
            <UButton type="button" variant="ghost" color="neutral" @click="open = false"
              >Cancel</UButton
            >
            <UButton type="submit" :loading="submitting" class="submit-button" icon="i-lucide-plus"
              >Create issue</UButton
            >
          </div>
        </footer>
      </form>
    </template>
  </UModal>
</template>

<style scoped>
.issue-form {
  min-width: 0;
  background: var(--orbit-surface);
  color: var(--orbit-text);
  overscroll-behavior: contain;
}
.issue-context {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 20px 24px 0;
  font-size: 11px;
  color: var(--orbit-subtle);
}
.team-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--orbit-text-secondary);
  background: var(--orbit-surface-muted);
  border: 1px solid var(--orbit-border);
  padding: 3px 6px;
  border-radius: 5px;
  font-size: 10px;
  font-weight: 600;
}
.draft-fields {
  padding: 13px 24px 20px;
}
.title-input,
.description-input {
  width: 100%;
  display: flex;
}
.title-input :deep(input),
.description-input :deep(textarea) {
  width: 100%;
  color: var(--orbit-text);
}
.title-input :deep(input::placeholder),
.description-input :deep(textarea::placeholder) {
  color: var(--orbit-subtle);
}
.issue-form :deep(:focus-visible) {
  outline: 2px solid var(--orbit-focus);
  outline-offset: 2px;
}
.title-input :deep(input:focus-visible),
.description-input :deep(textarea:focus-visible) {
  outline: 2px solid var(--orbit-focus);
  outline-offset: 4px;
  border-radius: 4px;
}
.issue-properties {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 0 24px 24px;
}
.property-field {
  min-width: 0;
  display: grid;
  gap: 7px;
}
.property-field label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--orbit-subtle);
  font-size: 11px;
}
.property-select {
  width: 100%;
  min-width: 0;
  color: var(--orbit-text-secondary);
  background: var(--orbit-surface-muted);
  font-size: 12px;
}
.property-select :deep([data-slot="value"]) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.form-error {
  padding: 0 24px 18px;
  font-size: 12px;
  color: var(--orbit-danger);
}
.form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 15px 24px;
  border-top: 1px solid var(--orbit-border);
}
.shortcut-hint {
  font-size: 10px;
  color: var(--orbit-subtle);
}
.form-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.submit-button {
  background: var(--orbit-brand);
  color: var(--orbit-on-brand);
  border: 1px solid var(--orbit-border);
  font-size: 12px;
}
@media (hover: hover) {
  .submit-button:hover {
    background: var(--orbit-brand-hover);
  }
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@media (max-width: 480px) {
  .issue-context {
    padding: 16px 16px 0;
  }
  .draft-fields {
    padding: 12px 16px 18px;
  }
  .issue-properties {
    gap: 12px;
    padding: 0 16px 20px;
  }
  .form-footer {
    padding: 14px 16px;
    justify-content: flex-end;
  }
  .shortcut-hint {
    display: none;
  }
  .form-error {
    padding: 0 16px 16px;
  }
}
@media (max-width: 340px) {
  .issue-properties {
    grid-template-columns: 1fr;
  }
}
</style>
