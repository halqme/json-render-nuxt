import { createStateStore } from "@json-render/core";
import { computed, shallowRef, ref, watch } from "vue";
import { useRoute, useRouter } from "#app";
import { initialActivities, initialIssues, people, projects } from "../../shared/mock-data";
import { priorities, statuses } from "../../shared/types";
import type {
  Activity,
  CreateIssueInput,
  Issue,
  TrackerState,
  WorkspaceId,
} from "../../shared/types";

const STORAGE_KEY = "linear-mock-tracker:v1";
const ACTIVE_WORKSPACE_KEY = "orbit:active-workspace";
const workspaces = {
  orbit: { name: "Orbit", storageKey: STORAGE_KEY },
  sandbox: { name: "Orbit Sandbox", storageKey: "linear-mock-tracker:sandbox:v1" },
} as const;
let workspaceId: WorkspaceId = "orbit";
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
let issues = clone(initialIssues);
let activityRecords = clone(initialActivities);
let hydrated = false;
let deriving = false;
let lastFilters = "";

const store = createStateStore({
  workspaceId,
  workspaceName: workspaces[workspaceId].name,
  view: "issues",
  query: "",
  statusFilter: "",
  priorityFilter: "",
  assigneeFilter: "",
  projectFilter: "",
  tab: "all",
  groups: [],
  allIssues: clone(issues),
  filteredCount: 0,
  totalCount: issues.length,
  projects: clone(projects),
  people: clone(people),
  selectedIssue: null,
  activities: [],
  draftComment: "",
  notice: "",
  selectedIds: [],
});
const snapshot = () => store.getSnapshot() as TrackerState;
const state = shallowRef<TrackerState>(snapshot());
const newIssueOpen = ref(false);
const currentView = computed(() => state.value.view);

function noFilter(value: string) {
  return !value || value === "all";
}

function derive() {
  if (deriving) return;
  deriving = true;
  try {
    const s = snapshot();
    const query = s.query.trim().toLowerCase();
    const scoped = issues.filter(
      (issue) =>
        (s.view !== "my-issues" || issue.assignee === "alex") &&
        (noFilter(s.projectFilter) || issue.project === s.projectFilter),
    );
    const filtered = scoped.filter(
      (issue) =>
        (!query ||
          [issue.id, issue.title, issue.description, ...issue.labels].some((text) =>
            text.toLowerCase().includes(query),
          )) &&
        (noFilter(s.statusFilter) || issue.status === s.statusFilter) &&
        (noFilter(s.priorityFilter) || issue.priority === s.priorityFilter) &&
        (noFilter(s.assigneeFilter) ||
          issue.assignee === (s.assigneeFilter === "unassigned" ? "" : s.assigneeFilter)) &&
        (s.tab === "all" || (s.tab === "done" ? issue.status === "Done" : issue.status !== "Done")),
    );
    const selected = issues.find((issue) => issue.id === s.selectedIssue?.id) ?? null;
    store.update({
      "/allIssues": clone(issues),
      "/groups": statuses.map((status) => {
        const groupIssues = filtered.filter((issue) => issue.status === status);
        return { status, count: groupIssues.length, issues: clone(groupIssues) };
      }),
      "/filteredCount": filtered.length,
      "/totalCount": scoped.length,
      "/projects": projects.map((project) => ({
        ...project,
        issueCount: issues.filter((issue) => issue.project === project.id).length,
      })),
      "/selectedIssue": selected ? clone(selected) : null,
      "/activities": clone(
        activityRecords
          .filter((activity) => activity.issueId === selected?.id)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      ),
      "/selectedIds": s.selectedIds.filter((id) => issues.some((issue) => issue.id === id)),
    });
  } finally {
    deriving = false;
    state.value = snapshot();
  }
}

// Built-in setState/$bindState writes take the same derivation path as handlers.
store.subscribe(() => {
  const s = snapshot();
  state.value = s;
  if (deriving) return;
  const filters = JSON.stringify([
    s.view,
    s.query,
    s.statusFilter,
    s.priorityFilter,
    s.assigneeFilter,
    s.projectFilter,
    s.tab,
  ]);
  if (filters !== lastFilters) {
    lastFilters = filters;
    derive();
  }
});
derive();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function validProperty(field: string, value: unknown): boolean {
  switch (field) {
    case "title":
      return typeof value === "string" && value.trim().length > 0;
    case "description":
      return typeof value === "string";
    case "status":
      return statuses.some((status) => status === value);
    case "priority":
      return priorities.some((priority) => priority === value);
    case "assignee":
      return value === "" || people.some((person) => person.id === value);
    case "project":
      return value === "" || projects.some((project) => project.id === value);
    case "labels":
      return Array.isArray(value) && value.every((label) => typeof label === "string");
    default:
      return false;
  }
}
function validIssue(value: unknown): value is Issue {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.createdAt === "string" &&
    Number.isFinite(Date.parse(value.createdAt)) &&
    ["title", "description", "status", "priority", "assignee", "project", "labels"].every((field) =>
      validProperty(field, value[field]),
    )
  );
}
function validActivity(value: unknown): value is Activity {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.issueId === "string" &&
    typeof value.author === "string" &&
    people.some((person) => person.id === value.author) &&
    typeof value.text === "string" &&
    typeof value.createdAt === "string" &&
    Number.isFinite(Date.parse(value.createdAt)) &&
    (value.type === "comment" || value.type === "change")
  );
}
function uniqueIds(records: { id: string }[]) {
  return new Set(records.map((record) => record.id)).size === records.length;
}
function loadWorkspace() {
  // Always begin with fresh records, never the workspace we just left.
  issues = clone(initialIssues);
  activityRecords = clone(initialActivities);
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(workspaces[workspaceId].storageKey);
    if (!raw) return;
    const saved: unknown = JSON.parse(raw);
    if (
      !isRecord(saved) ||
      !Array.isArray(saved.issues) ||
      !saved.issues.every(validIssue) ||
      !Array.isArray(saved.activities) ||
      !saved.activities.every(validActivity) ||
      !uniqueIds(saved.issues) ||
      !uniqueIds(saved.activities)
    ) {
      throw new Error("Invalid tracker data");
    }
    const savedIssues = saved.issues;
    if (
      !saved.activities.every((activity) =>
        savedIssues.some((issue) => issue.id === activity.issueId),
      )
    ) {
      throw new Error("Unknown activity issue");
    }
    issues = clone(savedIssues);
    activityRecords = clone(saved.activities);
  } catch {
    store.set("/notice", "Saved data could not be loaded. Using the sample workspace.");
  }
}
function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const preferred = window.localStorage.getItem(ACTIVE_WORKSPACE_KEY);
    if (preferred === "orbit" || preferred === "sandbox") workspaceId = preferred;
    else if (preferred !== null)
      store.set("/notice", "Saved workspace preference was invalid. Opening Orbit.");
  } catch {
    store.set("/notice", "Workspace preference could not be loaded. Opening Orbit.");
  }
  loadWorkspace();
  store.update({
    "/workspaceId": workspaceId,
    "/workspaceName": workspaces[workspaceId].name,
  });
  derive();
}
function persist(): boolean {
  if (typeof window === "undefined") return true;
  try {
    window.localStorage.setItem(
      workspaces[workspaceId].storageKey,
      JSON.stringify({ issues, activities: activityRecords }),
    );
    return true;
  } catch {
    store.set(
      "/notice",
      "Your change is available in this session, but could not be saved locally.",
    );
    return false;
  }
}
function addHistory(issueId: string, text: string, type: Activity["type"]) {
  let id = `activity-${Date.now()}-${activityRecords.length + 1}`;
  while (activityRecords.some((activity) => activity.id === id)) id += "-1";
  activityRecords.push({
    id,
    issueId,
    author: "alex",
    text,
    type,
    createdAt: new Date().toISOString(),
  });
}
function resetFilters() {
  store.update({
    "/query": "",
    "/statusFilter": "",
    "/priorityFilter": "",
    "/assigneeFilter": "",
    "/projectFilter": "",
    "/tab": "all",
    "/selectedIds": [],
  });
}
function changeProperty(params: Record<string, unknown>) {
  const issue = issues.find((record) => record.id === snapshot().selectedIssue?.id);
  if (!issue) {
    store.set("/notice", "Open an issue before changing a property.");
    return;
  }
  const { field, value } = params;
  if (typeof field !== "string" || !validProperty(field, value)) {
    store.set("/notice", "That issue property or value is not valid.");
    return;
  }
  const key = field as keyof Omit<Issue, "id" | "createdAt">;
  if (JSON.stringify(issue[key]) === JSON.stringify(value)) return;
  const display = (entry: unknown) => {
    if (key === "assignee")
      return people.find((person) => person.id === entry)?.name ?? "Unassigned";
    if (key === "project")
      return projects.find((project) => project.id === entry)?.name ?? "No project";
    return Array.isArray(entry)
      ? entry.join(", ") || "none"
      : typeof entry === "string"
        ? entry || "empty"
        : "empty";
  };
  const updated = { ...issue, [key]: clone(value) } as Issue;
  if (key === "title") updated.title = updated.title.trim();
  issues = issues.map((record) => (record.id === issue.id ? updated : record));
  addHistory(
    issue.id,
    `Changed ${key} from ${display(issue[key])} to ${display(updated[key])}.`,
    "change",
  );
  store.set("/notice", `${issue.id} updated.`);
  derive();
  persist();
}
function addComment() {
  const s = snapshot();
  if (!s.selectedIssue) {
    store.set("/notice", "Open an issue before adding a comment.");
    return;
  }
  const text = s.draftComment.trim();
  if (!text) {
    store.set("/notice", "Write a comment before posting.");
    return;
  }
  addHistory(s.selectedIssue.id, text, "comment");
  store.update({ "/draftComment": "", "/notice": "Comment added." });
  derive();
  persist();
}

/** Shared CSR workspace. Invoke within Nuxt setup so route composables have context. */
export function useTracker() {
  const route = useRoute();
  const router = useRouter();
  hydrate();
  const queryValue = (value: unknown) => (typeof value === "string" ? value : "");
  function selectIssue(id: string) {
    const issue = issues.find((record) => record.id === id) ?? null;
    const changed = snapshot().selectedIssue?.id !== issue?.id;
    store.update({
      "/selectedIssue": issue ? clone(issue) : null,
      ...(changed ? { "/draftComment": "" } : {}),
      ...(id && !issue ? { "/notice": `Issue ${id} was not found.` } : {}),
    });
    derive();
  }
  watch(
    () => [route.query.view, route.query.issue, route.query.project],
    () => {
      const view = queryValue(route.query.view) || "issues";
      const project = queryValue(route.query.project);
      const validProject = projects.some((record) => record.id === project) ? project : "";
      if (view !== snapshot().view || validProject !== snapshot().projectFilter) {
        resetFilters();
        store.update({ "/view": view, "/projectFilter": validProject });
      }
      if (project && !validProject) store.set("/notice", `Project ${project} was not found.`);
      selectIssue(queryValue(route.query.issue));
    },
    { immediate: true },
  );

  async function routeTo(query: Record<string, string>) {
    // Switching workspaces can legitimately keep the same issues URL.
    if (
      route.query.view === query.view &&
      (query.issue ? route.query.issue === query.issue : route.query.issue == null) &&
      (query.project ? route.query.project === query.project : route.query.project == null)
    )
      return;
    try {
      const result = await router.push({
        query: {
          ...route.query,
          view: query.view,
          issue: query.issue || undefined,
          project: query.project || undefined,
        },
      });
      if (result) store.set("/notice", "Navigation did not complete. Try again.");
    } catch {
      store.set("/notice", "Navigation failed. Your workspace changes are still available.");
    }
  }
  function navigate(view: string, project?: string) {
    if (!view.trim() || (project && !projects.some((record) => record.id === project))) {
      store.set("/notice", "Choose a valid view and project.");
      return;
    }
    resetFilters();
    store.update({ "/view": view, "/projectFilter": project || "" });
    selectIssue("");
    return routeTo({ view, project: project || "", issue: "" });
  }
  async function switchWorkspace(id: string): Promise<void> {
    if (id !== "orbit" && id !== "sandbox") {
      store.set("/notice", "Choose Orbit or Orbit Sandbox.");
      return;
    }
    if (id === workspaceId) return;
    if (!persist()) {
      store.set(
        "/notice",
        "Workspace could not be saved. Switching was canceled to keep your unsaved changes.",
      );
      return;
    }
    workspaceId = id;
    store.set("/notice", "");
    loadWorkspace();
    const loadNotice = snapshot().notice;
    store.update({
      "/workspaceId": workspaceId,
      "/workspaceName": workspaces[workspaceId].name,
      "/selectedIssue": null,
      "/activities": [],
      "/draftComment": "",
      "/selectedIds": [],
    });
    newIssueOpen.value = false;
    resetFilters();
    derive();
    let preferenceNotice = "";
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
      } catch {
        preferenceNotice = " Your workspace preference could not be saved locally.";
      }
    }
    store.set(
      "/notice",
      `Switched to ${workspaces[workspaceId].name}, an isolated local demo workspace. Changes do not transfer between workspaces.${loadNotice ? ` ${loadNotice}` : ""}${preferenceNotice}`,
    );
    await navigate("issues");
  }
  function openIssue(id: string) {
    if (id && !issues.some((record) => record.id === id)) {
      store.set("/notice", `Issue ${id} was not found.`);
      return;
    }
    selectIssue(id);
    return routeTo({
      view: snapshot().view,
      project: snapshot().projectFilter === "all" ? "" : snapshot().projectFilter,
      issue: id,
    });
  }
  function createIssue(input: CreateIssueInput): Issue | null {
    const values = {
      title: input.title,
      description: input.description ?? "",
      status: input.status ?? "Todo",
      priority: input.priority ?? "Medium",
      assignee: input.assignee ?? "alex",
      project:
        input.project ??
        (projects.some((project) => project.id === snapshot().projectFilter)
          ? snapshot().projectFilter
          : ""),
      labels: input.labels ?? [],
    };
    if (!Object.entries(values).every(([field, value]) => validProperty(field, value))) {
      store.set("/notice", "Enter a title and valid issue properties.");
      return null;
    }
    const number =
      Math.max(100, ...issues.map((issue) => Number(/^ENG-(\d+)$/.exec(issue.id)?.[1]) || 0)) + 1;
    const issue: Issue = {
      ...clone(values),
      title: values.title.trim(),
      id: `ENG-${number}`,
      createdAt: new Date().toISOString(),
    };
    issues.unshift(issue);
    addHistory(issue.id, "Created this issue.", "change");
    newIssueOpen.value = false;
    store.set("/notice", `${issue.id} created.`);
    derive();
    persist();
    void openIssue(issue.id);
    return clone(issue);
  }
  // Action $item expressions resolve to repeat-item JSON Pointers in 0.21.
  const readPointer = (path: unknown) =>
    typeof path === "string" && path.startsWith("/") ? store.get(path) : undefined;
  const handlers = {
    navigate: (params: Record<string, unknown> = {}) =>
      navigate(
        typeof params.view === "string" ? params.view : "",
        typeof params.project === "string"
          ? params.project
          : (readPointer(params.projectPath) as string | undefined),
      ),
    openIssue: (params: Record<string, unknown> = {}) =>
      openIssue(
        typeof params.id === "string" ? params.id : (readPointer(params.idPath) as string) || "",
      ),
    newIssue: () => {
      newIssueOpen.value = true;
    },
    resetFilters,
    changeProperty,
    addComment,
    toggleSelection: (params: Record<string, unknown> = {}) => {
      const id = readPointer(params.idPath);
      if (typeof id !== "string" || !issues.some((issue) => issue.id === id)) {
        store.set("/notice", "Choose an existing issue to select.");
        return;
      }
      const ids = snapshot().selectedIds;
      store.set(
        "/selectedIds",
        ids.includes(id) ? ids.filter((selectedId) => selectedId !== id) : [...ids, id],
      );
    },
    setTab: (params: Record<string, unknown> = {}) => {
      if (params.value === "all" || params.value === "active" || params.value === "done")
        store.set("/tab", params.value);
      else store.set("/notice", "Choose all, active, or done issues.");
    },
  };
  return {
    store,
    state,
    navigate,
    switchWorkspace,
    openIssue,
    handlers,
    newIssueOpen,
    createIssue,
    currentView,
    resetFilters,
  };
}
