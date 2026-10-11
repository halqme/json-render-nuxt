import { createStateStore } from "@json-render/core";
import { computed, shallowRef, ref, watch } from "vue";
import { useRoute, useRouter } from "#app";
import { people } from "../../shared/mock-data";
import { demoPersonaIds, priorities, statuses } from "../../shared/types";
import type {
  Activity,
  CreateIssueInput,
  DemoPersona,
  DemoPersonaInfo,
  Issue,
  Project,
  TrackerState,
  WorkspaceId,
} from "../../shared/types";

const ACTIVE_WORKSPACE_KEY = "orbit:active-workspace";
const workspaces = {
  orbit: { name: "Orbit" },
  sandbox: { name: "Orbit Sandbox" },
} as const;
let workspaceId: WorkspaceId = "orbit";
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
let issues: Issue[] = [];
let activityRecords: Activity[] = [];
let projectRecords: Project[] = [];
let loading: Promise<boolean> | null = null;
let recordsLoaded = false;
let busy = false;
let hydrated = false;
let deriving = false;
let lastFilters = "";

const store = createStateStore({
  persona: "employee" as DemoPersona,
  personaUserId: null as string | null,
  personaName: "Alex Morgan",
  personaInitials: "AM",
  personaRole: "Employee",
  personas: [] as DemoPersonaInfo[],
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
  projects: [],
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
        (s.view !== "my-issues" ||
          (s.personaUserId !== null && issue.assignee === s.personaUserId)) &&
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
      "/projects": projectRecords.map((project) => ({
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
    s.personaUserId,
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
      return value === "" || projectRecords.some((project) => project.id === value);
    case "labels":
      return Array.isArray(value) && value.every((label) => typeof label === "string");
    default:
      return false;
  }
}
type Records = { issues: Issue[]; activities: Activity[] };
type ProjectResponse = { projects: Project[]; people: typeof people };
type PersonaResponse = {
  persona: DemoPersona;
  personaInfo: DemoPersonaInfo;
  personas: DemoPersonaInfo[];
};

function applyRecords(records: Records) {
  issues = records.issues;
  activityRecords = records.activities;
  derive();
}
async function loadWorkspace(id = workspaceId): Promise<boolean> {
  try {
    const [records, projectData] = await Promise.all([
      $fetch<Records>(`/api/workspaces/${id}/records`, { retry: 0 }),
      $fetch<ProjectResponse>(`/api/workspaces/${id}/projects`, { retry: 0 }),
    ]);
    workspaceId = id;
    projectRecords = projectData.projects;
    store.update({ "/workspaceId": id, "/workspaceName": workspaces[id].name, "/notice": "" });
    store.set("/people", clone(projectData.people));
    applyRecords(records);
    recordsLoaded = true;
    return true;
  } catch {
    store.set(
      "/notice",
      "Records could not be loaded. Reload to retry; no sample data was substituted.",
    );
    return false;
  }
}
async function loadPersona() {
  const session = await $fetch<PersonaResponse>("/api/demo/persona", { retry: 0 });
  store.update({
    "/persona": session.persona,
    "/personaUserId": session.personaInfo.userId,
    "/personaName": session.personaInfo.name,
    "/personaInitials": session.personaInfo.initials,
    "/personaRole": session.personaInfo.role,
    "/personas": session.personas,
  });
}
function hydrate(): Promise<boolean> {
  if (loading) return loading;
  if (hydrated || typeof window === "undefined") return Promise.resolve(hydrated);
  hydrated = true;
  try {
    const preferred = window.localStorage.getItem(ACTIVE_WORKSPACE_KEY);
    if (preferred === "orbit" || preferred === "sandbox") workspaceId = preferred;
    else if (preferred !== null)
      store.set("/notice", "Saved workspace preference was invalid. Opening Orbit.");
  } catch {
    store.set("/notice", "Workspace preference could not be loaded. Opening Orbit.");
  }
  loading = (async () => {
    try {
      await loadPersona();
      return await loadWorkspace();
    } catch {
      store.set("/notice", "Demo persona could not be loaded. Reload to retry.");
      return false;
    }
  })();
  return loading;
}
async function mutate(path: string, method: "POST" | "PATCH", body: unknown) {
  if (loading) await loading;
  if (!recordsLoaded) {
    store.set("/notice", "Load the workspace records before saving. Reload to retry.");
    return null;
  }
  if (busy) {
    store.set("/notice", "Wait for the current save to finish.");
    derive();
    return null;
  }
  busy = true;
  store.set("/notice", "Saving…");
  derive();
  try {
    const result = await $fetch<Records & { issue?: Issue }>(
      `/api/workspaces/${workspaceId}/${path}`,
      { method, body: body as Record<string, unknown>, retry: 0 },
    );
    applyRecords(result);
    return result;
  } catch {
    store.set(
      "/notice",
      "Save could not be confirmed. Your draft was kept. Reload to check the server before retrying.",
    );
    derive();
    return null;
  } finally {
    busy = false;
  }
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
async function changeProperty(params: Record<string, unknown>) {
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
  if (await mutate(`issues/${issue.id}`, "PATCH", { [key]: value }))
    store.set("/notice", `${issue.id} updated.`);
}
async function addComment() {
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
  if (await mutate(`issues/${s.selectedIssue.id}/comments`, "POST", { text })) {
    store.update({
      ...(snapshot().draftComment === s.draftComment ? { "/draftComment": "" } : {}),
      "/notice": "Comment added.",
    });
  }
}
async function workflowAction(params: Record<string, unknown> = {}) {
  const s = snapshot();
  const action = params.action;
  if (
    !s.selectedIssue ||
    typeof action !== "string" ||
    !["start-work", "request-review", "approve"].includes(action)
  ) {
    store.set("/notice", "That workflow action is not available.");
    return;
  }
  const result = await mutate(`issues/${s.selectedIssue.id}/workflow`, "POST", { action });
  if (result?.issue) store.set("/notice", `${result.issue.id} workflow updated.`);
}

/** Shared CSR workspace. Invoke within Nuxt setup so route composables have context. */
export function useTracker() {
  const route = useRoute();
  const router = useRouter();
  const ready = hydrate();
  const queryValue = (value: unknown) => (typeof value === "string" ? value : "");
  function selectIssue(id: string) {
    const issue = issues.find((record) => record.id === id) ?? null;
    const changed = snapshot().selectedIssue?.id !== issue?.id;
    store.update({
      "/selectedIssue": issue ? clone(issue) : null,
      ...(changed ? { "/draftComment": "" } : {}),
      ...(id && !issue ? { "/notice": `Issue ${id} is unavailable for this demo persona.` } : {}),
    });
    derive();
    if (id && !issue) {
      void routeTo({
        view: snapshot().view,
        project: snapshot().projectFilter,
        issue: "",
      });
    }
  }
  function syncRoute() {
    if (!recordsLoaded) return;
    {
      const view = queryValue(route.query.view) || "issues";
      const project = queryValue(route.query.project);
      const validProject = projectRecords.some((record) => record.id === project) ? project : "";
      if (view !== snapshot().view || validProject !== snapshot().projectFilter) {
        resetFilters();
        store.update({ "/view": view, "/projectFilter": validProject });
      }
      if (project && !validProject) {
        store.set("/notice", `Project ${project} is unavailable for this demo persona.`);
        void routeTo({ view, project: "", issue: "" });
      }
      selectIssue(queryValue(route.query.issue));
    }
  }
  void ready.then((success) => {
    if (success) syncRoute();
  });
  watch(() => [route.query.view, route.query.issue, route.query.project], syncRoute, {
    immediate: true,
  });

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
  async function switchPersona(persona: DemoPersona) {
    await ready;
    if (!demoPersonaIds.includes(persona)) {
      store.set("/notice", "Choose an available demo persona.");
      return;
    }
    if (persona === snapshot().persona) return;
    if (busy) {
      store.set("/notice", "Wait for the current save before switching demo personas.");
      return;
    }

    const selectedIssueId = snapshot().selectedIssue?.id ?? "";
    busy = true;
    recordsLoaded = false;
    issues = [];
    activityRecords = [];
    projectRecords = [];
    store.update({
      "/allIssues": [],
      "/groups": statuses.map((status) => ({ status, count: 0, issues: [] })),
      "/filteredCount": 0,
      "/totalCount": 0,
      "/projects": [],
      "/selectedIssue": null,
      "/activities": [],
      "/draftComment": "",
      "/selectedIds": [],
      "/projectFilter": "",
    });
    derive();
    try {
      const session = await $fetch<PersonaResponse>("/api/demo/persona", {
        method: "POST",
        body: { persona },
        retry: 0,
      });
      store.update({
        "/persona": session.persona,
        "/personaUserId": session.personaInfo.userId,
        "/personaName": session.personaInfo.name,
        "/personaInitials": session.personaInfo.initials,
        "/personaRole": session.personaInfo.role,
        "/personas": session.personas,
      });
      if (!(await loadWorkspace())) return;
      resetFilters();
      store.update({ "/draftComment": "", "/selectedIds": [] });
      const stillReadable = selectedIssueId && issues.some((issue) => issue.id === selectedIssueId);
      if (stillReadable) selectIssue(selectedIssueId);
      else store.update({ "/selectedIssue": null, "/activities": [] });
      newIssueOpen.value = false;
      derive();
      await routeTo({
        view: snapshot().view,
        project: snapshot().projectFilter,
        issue: stillReadable ? selectedIssueId : "",
      });
      store.set(
        "/notice",
        `Switched to ${session.personaInfo.name} (${session.personaInfo.role}).`,
      );
    } catch {
      try {
        await loadPersona();
        await loadWorkspace();
      } catch {
        recordsLoaded = false;
      }
      store.set(
        "/notice",
        "Demo persona could not be changed. Reload to check the current session.",
      );
    } finally {
      busy = false;
    }
  }
  function navigate(view: string, project?: string) {
    if (!view.trim() || (project && !projectRecords.some((record) => record.id === project))) {
      store.set("/notice", "Choose a valid view and project.");
      return;
    }
    resetFilters();
    store.update({ "/view": view, "/projectFilter": project || "" });
    selectIssue("");
    return routeTo({ view, project: project || "", issue: "" });
  }
  async function switchWorkspace(id: string): Promise<void> {
    await ready;
    if (id !== "orbit" && id !== "sandbox") {
      store.set("/notice", "Choose Orbit or Orbit Sandbox.");
      return;
    }
    if (id === workspaceId) return;
    if (busy) {
      store.set("/notice", "Wait for the current save before switching workspaces.");
      return;
    }
    busy = true;
    const loaded = await loadWorkspace(id);
    busy = false;
    if (!loaded) return;
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
      `Switched to ${workspaces[workspaceId].name}. Records are stored independently on this server.${preferenceNotice}`,
    );
    await navigate("issues");
  }
  function toggleIssueSelection(id: string) {
    if (!issues.some((record) => record.id === id)) return;
    const selectedIds = snapshot().selectedIds;
    store.set(
      "/selectedIds",
      selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id],
    );
  }
  function openIssue(id: string) {
    if (id && !issues.some((record) => record.id === id)) {
      store.set("/notice", `Issue ${id} is unavailable for this demo persona.`);
      return;
    }
    selectIssue(id);
    return routeTo({
      view: snapshot().view,
      project: snapshot().projectFilter === "all" ? "" : snapshot().projectFilter,
      issue: id,
    });
  }
  async function createIssue(input: CreateIssueInput): Promise<Issue | null> {
    const values = {
      title: input.title,
      description: input.description ?? "",
      priority: input.priority ?? "Medium",
      assignee: input.assignee ?? snapshot().personaUserId ?? "",
      project:
        input.project ??
        (projectRecords.some((project) => project.id === snapshot().projectFilter)
          ? snapshot().projectFilter
          : ""),
      labels: input.labels ?? [],
    };
    if (!Object.entries(values).every(([field, value]) => validProperty(field, value))) {
      store.set("/notice", "Enter a title and valid issue properties.");
      return null;
    }
    const result = await mutate("issues", "POST", values);
    const issue = result?.issue;
    if (!issue) return null;
    newIssueOpen.value = false;
    store.set("/notice", `${issue.id} created.`);
    derive();
    void openIssue(issue.id);
    return clone(issue);
  }
  return {
    store,
    state,
    navigate,
    switchWorkspace,
    openIssue,
    toggleIssueSelection,
    changeProperty,
    addComment,
    newIssueOpen,
    createIssue,
    currentView,
    resetFilters,
    switchPersona,
    workflowAction,
    canWrite: computed(() => state.value.persona !== "guest"),
  };
}
