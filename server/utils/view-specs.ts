import type { Spec } from "@json-render/core";
import type { DemoPersona, Issue } from "../../shared/types";
import { people } from "../../shared/mock-data";
import { priorities, statuses } from "../../shared/types";
import { availableWorkflowAction } from "./personas";
import { validateViewSpec } from "../../shared/validate-view";

const workflowActionLabels = {
  "start-work": "Start work",
  "request-review": "Request review",
  approve: "Approve issue",
} as const;

export function getIssuePanelSpec(persona: DemoPersona, issue: Issue): Spec {
  const action = availableWorkflowAction(persona, issue.status);
  const message =
    persona === "guest"
      ? "Guest access is read-only. You can review the issue, but cannot change its workflow."
      : issue.status === "In review" && action === null
        ? "This issue is in review. A manager must approve it."
        : issue.status === "Done"
          ? "This issue is complete."
          : `Available action for ${persona}: ${action ? workflowActionLabels[action] : "none"}.`;
  const children = ["status", "message"];
  if (persona === "guest" || issue.status === "Done") children.reverse();
  if (action) children.push("advance");

  const spec: Spec = {
    root: "panel",
    elements: {
      panel: {
        type: "WorkflowPanel",
        props: { issueId: issue.id },
        children,
      },
      message: { type: "PanelMessage", props: { text: message }, children: [] },
      status: { type: "WorkflowStatus", props: { status: issue.status }, children: [] },
      ...(action
        ? {
            advance: {
              type: "WorkflowButton",
              props: { action, label: workflowActionLabels[action] },
              children: [],
              on: {
                advance: {
                  action: "workflowAction",
                  params: { action },
                },
              },
            },
          }
        : {}),
    },
  };
  return validateViewSpec(spec);
}

/** Compose the full detail surface around the persona-specific workflow panel. */
export function getIssueDetailSpec(persona: DemoPersona, issue: Issue): Spec {
  const panel = getIssuePanelSpec(persona, issue);
  const elements: Spec["elements"] = {
    detail: { type: "DetailLayout", props: {}, children: ["back", "heading", "columns"] },
    back: {
      type: "DetailBackButton",
      props: {},
      children: [],
      on: { press: { action: "backToIssues", params: {} } },
    },
    heading: { type: "IssueHeading", props: { issue: { $state: "/selectedIssue" } }, children: [] },
    columns: {
      type: "DetailColumns",
      props: {},
      children: ["description", "activity", "comment", "readOnly"],
      slots: { sidebar: ["properties", "workflow"] },
    },
    description: {
      type: "IssueDescription",
      props: { description: { $state: "/selectedIssue/description" } },
      children: [],
    },
    activity: {
      type: "IssueActivity",
      props: {},
      children: ["activity-rows", "activity-empty"],
    },
    "activity-rows": {
      type: "RepeatContainer",
      props: {},
      repeat: { statePath: "/activities", key: "id" },
      children: ["activity-item"],
    },
    "activity-item": {
      type: "ActivityItem",
      props: { activity: { $item: "" }, people: { $state: "/people" } },
      children: [],
    },
    "activity-empty": {
      type: "EmptyActivityNotice",
      props: { text: "No activity yet." },
      children: [],
      visible: { $state: "/activities.length", eq: 0 },
    },
    comment: {
      type: "CommentComposer",
      props: { modelValue: { $bindState: "/draftComment" } },
      children: [],
      visible: { $state: "/persona", neq: "guest" },
      on: { post: { action: "addComment", params: {} } },
    },
    readOnly: {
      type: "ReadOnlyNotice",
      props: { text: "Guest access is read-only. Comments are disabled." },
      children: [],
      visible: { $state: "/persona", eq: "guest" },
    },
    properties: {
      type: "IssueProperties",
      props: {},
      children: [
        "status-value",
        "priority-value",
        "priority-edit",
        "assignee-value",
        "assignee-edit",
        "project-value",
        "project-edit",
      ],
    },
    "status-value": {
      type: "PropertyValue",
      props: {
        label: "Status",
        field: "status",
        value: { $state: "/selectedIssue/status" },
        options: [],
      },
      children: [],
    },
    "priority-value": {
      type: "PropertyValue",
      props: {
        label: "Priority",
        field: "priority",
        value: { $state: "/selectedIssue/priority" },
        options: [],
      },
      children: [],
      visible: { $state: "/persona", eq: "guest" },
    },
    "priority-edit": {
      type: "PropertyEditor",
      props: {
        label: "Priority",
        field: "priority",
        value: { $bindState: "/selectedIssue/priority" },
        options: [],
      },
      children: [],
      visible: { $state: "/persona", neq: "guest" },
      on: {
        change: {
          action: "changeProperty",
          params: { field: "priority", value: { $state: "/selectedIssue/priority" } },
        },
      },
    },
    "assignee-value": {
      type: "PropertyValue",
      props: {
        label: "Assignee",
        field: "assignee",
        value: { $state: "/selectedIssue/assignee" },
        options: { $state: "/people" },
      },
      children: [],
      visible: { $state: "/persona", eq: "guest" },
    },
    "assignee-edit": {
      type: "PropertyEditor",
      props: {
        label: "Assignee",
        field: "assignee",
        value: { $bindState: "/selectedIssue/assignee" },
        options: { $state: "/people" },
      },
      children: [],
      visible: { $state: "/persona", neq: "guest" },
      on: {
        change: {
          action: "changeProperty",
          params: { field: "assignee", value: { $state: "/selectedIssue/assignee" } },
        },
      },
    },
    "project-value": {
      type: "PropertyValue",
      props: {
        label: "Project",
        field: "project",
        value: { $state: "/selectedIssue/project" },
        options: { $state: "/projects" },
      },
      children: [],
      visible: { $state: "/persona", eq: "guest" },
    },
    "project-edit": {
      type: "PropertyEditor",
      props: {
        label: "Project",
        field: "project",
        value: { $bindState: "/selectedIssue/project" },
        options: { $state: "/projects" },
      },
      children: [],
      visible: { $state: "/persona", neq: "guest" },
      on: {
        change: {
          action: "changeProperty",
          params: { field: "project", value: { $state: "/selectedIssue/project" } },
        },
      },
    },
    workflow: {
      type: "WorkflowPanel",
      props: { issueId: issue.id },
      children: panel.elements.panel!.children,
    },
  };
  for (const [id, element] of Object.entries(panel.elements)) {
    if (id !== "panel") elements[`workflow-${id}`] = element;
  }
  // Prefix child references so workflow identifiers cannot collide with page elements.
  elements.workflow!.children = (elements.workflow!.children as string[]).map(
    (id) => `workflow-${id}`,
  );
  return validateViewSpec({ root: "detail", elements });
}

const issueStatuses = [
  { label: "All statuses", value: "all" },
  ...statuses.map((status) => ({ label: status, value: status })),
];
const issuePriorities = [
  { label: "All priorities", value: "all" },
  ...priorities.map((priority) => ({ label: priority, value: priority })),
];
const issueAssignees = [
  { label: "All assignees", value: "all" },
  { label: "Unassigned", value: "unassigned" },
  ...people.map((person) => ({ label: person.name, value: person.id })),
];

function viewSpec(root: string, elements: Spec["elements"]): Spec {
  return validateViewSpec({ root, elements });
}

/** A workspace-neutral list composition; live filtered records remain in client state. */
export function getIssueListSpec(view: "issues" | "my-issues"): Spec {
  const elements: Spec["elements"] = {
    page: {
      type: "PageLayout",
      props: {},
      children: ["header", "filters", "summary", "groups", "empty"],
    },
    header: {
      type: "PageHeader",
      props: {
        view,
        count: { $state: "/totalCount" },
        projectFilter: { $state: "/projectFilter" },
        projects: { $state: "/projects" },
      },
      children: ["new-issue"],
    },
    "new-issue": {
      type: "NewIssueButton",
      props: {},
      children: [],
      visible: { $state: "/persona", neq: "guest" },
      on: { press: { action: "openNewIssue", params: {} } },
    },
    filters: {
      type: "IssueFilters",
      props: {
        query: { $bindState: "/query" },
        statusFilter: { $bindState: "/statusFilter" },
        priorityFilter: { $bindState: "/priorityFilter" },
        assigneeFilter: { $bindState: "/assigneeFilter" },
        tab: { $bindState: "/tab" },
        statuses: issueStatuses,
        priorities: issuePriorities,
        assignees: issueAssignees,
      },
      children: [],
      on: { reset: { action: "resetFilters", params: {} } },
    },
    summary: {
      type: "IssueListSummary",
      props: {
        filteredCount: { $state: "/filteredCount" },
        totalCount: { $state: "/totalCount" },
        selectedIds: { $state: "/selectedIds" },
      },
      children: [],
    },
    groups: {
      type: "RepeatContainer",
      props: {},
      repeat: { statePath: "/groups", key: "status" },
      children: ["group"],
    },
    group: {
      type: "IssueGroup",
      props: { status: { $item: "status" }, count: { $item: "count" } },
      visible: { $item: "count", gt: 0 },
      children: ["rows"],
    },
    rows: {
      type: "RepeatContainer",
      props: {},
      repeat: { statePath: { $item: "issues" }, key: "id" },
      children: ["row"],
    },
    row: {
      type: "IssueRow",
      props: {
        issue: { $item: "" },
        people: { $state: "/people" },
        projects: { $state: "/projects" },
        selectedIds: { $state: "/selectedIds" },
      },
      children: [],
      on: {
        open: { action: "openIssue", params: { issueId: { $item: "id" } } },
        toggle: { action: "toggleIssueSelection", params: { issueId: { $item: "id" } } },
      },
    },
    empty: {
      type: "EmptyIssueState",
      props: {},
      children: [],
      visible: { $state: "/filteredCount", eq: 0 },
      on: { reset: { action: "resetFilters", params: {} } },
    },
  };
  return viewSpec("page", elements);
}

/** A workspace-neutral project composition; project records stay in client state. */
export function getProjectsSpec(): Spec {
  const elements: Spec["elements"] = {
    page: {
      type: "PageLayout",
      props: {},
      children: ["header", "eyebrow", "grid", "empty", "caption"],
    },
    header: {
      type: "PageHeader",
      props: {
        view: "projects",
        count: { $state: "/projects.length" },
        projectFilter: "",
        projects: { $state: "/projects" },
      },
      children: ["view-issues"],
    },
    "view-issues": {
      type: "PageActionButton",
      props: { label: "View all issues", icon: "i-lucide-arrow-up-right" },
      children: [],
      on: { press: { action: "navigateToIssues", params: {} } },
    },
    eyebrow: {
      type: "ProjectIntro",
      props: { text: "WORKSPACE INITIATIVES" },
      children: [],
    },
    grid: {
      type: "ProjectGrid",
      props: {},
      repeat: { statePath: "/projects", key: "id" },
      children: ["project-card"],
    },
    "project-card": {
      type: "ProjectCard",
      props: { project: { $item: "" }, people: { $state: "/people" } },
      children: [],
      on: { open: { action: "openProject", params: { projectId: { $item: "id" } } } },
    },
    empty: {
      type: "EmptyProjectNotice",
      props: { text: "No projects are available to this demo persona." },
      children: [],
      visible: { $state: "/projects.length", eq: 0 },
    },
    caption: {
      type: "PageCaption",
      props: {
        text: "Select a project to explore its issues. Progress reflects the current project milestone.",
      },
      children: [],
    },
  };
  return viewSpec("page", elements);
}
