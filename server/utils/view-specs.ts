import type { Spec } from "@json-render/core";
import { validateViewSpec } from "../../shared/validate-view";
import { people, projects } from "../../shared/mock-data";
import { statuses, priorities } from "../../shared/types";

const state = (path: string) => ({ $state: path });
const bind = (path: string) => ({ $bindState: path });
const item = (path: string) => ({ $item: path });
const choices = (values: readonly string[]) => values.map((value) => ({ label: value, value }));
const peopleOptions = [
  { label: "Unassigned", value: "" },
  ...people.map((p) => ({ label: p.name, value: p.id })),
];
const projectOptions = [
  { label: "No project", value: "" },
  ...projects.map((p) => ({ label: p.name, value: p.id })),
];

function issuesView(mine: boolean): Spec {
  return {
    root: "page",
    elements: {
      page: {
        type: "Stack",
        props: { variant: "page" },
        children: ["heading", "tabs", "toolbar", "summary", "groups", "empty"],
      },
      heading: {
        type: "PageHeader",
        props: {
          title: mine ? "My issues" : "All issues",
          subtitle: mine
            ? "Your work, with a little more focus."
            : "Everything your team is moving forward.",
          icon: mine ? "i-lucide-circle-user-round" : "i-lucide-layers-2",
          count: state("/totalCount"),
        },
        children: ["create"],
      },
      create: {
        type: "Button",
        props: { label: "New issue", icon: "i-lucide-plus", variant: "primary" },
        on: { press: { action: "newIssue", params: {} } },
      },
      tabs: {
        type: "Tabs",
        props: {
          value: bind("/tab"),
          options: [
            { label: "All issues", value: "all" },
            { label: "Active", value: "active" },
            { label: "Completed", value: "done" },
          ],
        },
      },
      toolbar: {
        type: "Toolbar",
        props: {},
        children: ["search", "status", "priority", "assignee", "clear"],
      },
      search: {
        type: "SearchField",
        props: { value: bind("/query"), placeholder: "Search issues…" },
      },
      status: {
        type: "SelectField",
        props: {
          label: "Status",
          icon: "i-lucide-circle-dashed",
          value: bind("/statusFilter"),
          options: [{ label: "All statuses", value: "" }, ...choices(statuses)],
        },
      },
      priority: {
        type: "SelectField",
        props: {
          label: "Priority",
          icon: "i-lucide-signal-high",
          value: bind("/priorityFilter"),
          options: [{ label: "All priorities", value: "" }, ...choices(priorities)],
        },
      },
      assignee: {
        type: "SelectField",
        props: {
          label: "Assignee",
          icon: "i-lucide-user-round",
          value: bind("/assigneeFilter"),
          options: [
            { label: "All assignees", value: "" },
            { label: "Unassigned", value: "unassigned" },
            ...peopleOptions.slice(1),
          ],
        },
      },
      clear: {
        type: "Button",
        props: { label: "Reset", icon: "i-lucide-rotate-ccw", variant: "ghost" },
        on: { press: { action: "resetFilters", params: {} } },
      },
      summary: {
        type: "ListSummary",
        props: { count: state("/filteredCount"), total: state("/totalCount") },
      },
      groups: {
        type: "Stack",
        props: { variant: "groups" },
        repeat: { statePath: "/groups", key: "status" },
        children: ["group"],
      },
      group: {
        type: "IssueGroup",
        props: { status: item("status"), count: item("count") },
        visible: { $item: "count", neq: 0 },
        children: ["rows"],
      },
      rows: {
        type: "Stack",
        props: { variant: "rows" },
        repeat: { statePath: item("issues"), key: "id" },
        children: ["row"],
      },
      row: {
        type: "IssueRow",
        props: { issue: item("") },
        on: {
          open: { action: "openIssue", params: { idPath: item("id") } },
          select: { action: "toggleSelection", params: { idPath: item("id") } },
        },
      },
      empty: {
        type: "EmptyState",
        props: {
          title: "No issues found",
          description: "Try a different search or reset your filters to see more work.",
          icon: "i-lucide-search-x",
        },
        visible: { $state: "/filteredCount", eq: 0 },
        children: ["empty-reset"],
      },
      "empty-reset": {
        type: "Button",
        props: { label: "Reset filters", variant: "secondary" },
        on: { press: { action: "resetFilters", params: {} } },
      },
    },
  };
}

const detail: Spec = {
  root: "detail",
  elements: {
    detail: {
      type: "Stack",
      props: { variant: "detail" },
      children: ["back", "identity", "content"],
    },
    back: {
      type: "Button",
      props: { label: "Back to issues", icon: "i-lucide-arrow-left", variant: "ghost" },
      on: { press: { action: "openIssue", params: { id: "" } } },
    },
    identity: {
      type: "IssueHeading",
      props: {
        id: state("/selectedIssue/id"),
        title: state("/selectedIssue/title"),
        labels: state("/selectedIssue/labels"),
      },
    },
    content: { type: "Grid", props: { variant: "detail" }, children: ["body", "properties"] },
    body: {
      type: "Stack",
      props: { variant: "plain" },
      children: ["description", "activity", "comment-section"],
    },
    description: {
      type: "Section",
      props: { title: "Description", variant: "description" },
      children: ["description-text"],
    },
    "description-text": {
      type: "Text",
      props: { text: state("/selectedIssue/description"), variant: "body" },
    },
    activity: {
      type: "Section",
      props: { title: "Activity", variant: "activity" },
      children: ["events", "no-activity"],
    },
    events: {
      type: "Stack",
      props: { variant: "activity" },
      repeat: { statePath: "/activities", key: "id" },
      children: ["event"],
    },
    event: { type: "ActivityItem", props: { activity: item("") } },
    "no-activity": {
      type: "Text",
      props: { text: "No activity yet. Start the conversation below.", variant: "caption" },
      visible: { $state: "/activities/length", eq: 0 },
    },
    "comment-section": {
      type: "Section",
      props: { title: "Add a comment", variant: "comment" },
      children: ["comment", "post"],
    },
    comment: {
      type: "CommentField",
      props: { value: bind("/draftComment"), placeholder: "Share an update or ask a question…" },
    },
    post: {
      type: "Button",
      props: { label: "Post comment", icon: "i-lucide-arrow-up", variant: "primary" },
      on: { press: { action: "addComment", params: {} } },
    },
    properties: {
      type: "Section",
      props: { title: "Properties", variant: "properties" },
      children: ["status", "priority", "assignee", "project"],
    },
    ...Object.fromEntries(
      (
        [
          ["status", choices(statuses)],
          ["priority", choices(priorities)],
          ["assignee", peopleOptions],
          ["project", projectOptions],
        ] satisfies [string, { label: string; value: string }[]][]
      ).map(([field, options]) => [
        String(field),
        {
          type: "PropertyField",
          props: {
            label: String(field)[0]!.toUpperCase() + String(field).slice(1),
            field,
            value: bind(`/selectedIssue/${field}`),
            options,
          },
          on: {
            change: {
              action: "changeProperty",
              params: { field, value: state(`/selectedIssue/${field}`) },
            },
          },
        },
      ]),
    ),
  },
};

const projectView: Spec = {
  root: "page",
  elements: {
    page: {
      type: "Stack",
      props: { variant: "page" },
      children: ["heading", "intro", "cards", "footer"],
    },
    heading: {
      type: "PageHeader",
      props: {
        title: "Projects",
        subtitle: "The bigger picture, one milestone at a time.",
        icon: "i-lucide-box",
        count: projects.length,
      },
      children: ["issues"],
    },
    issues: {
      type: "Button",
      props: { label: "View all issues", icon: "i-lucide-arrow-up-right", variant: "secondary" },
      on: { press: { action: "navigate", params: { view: "issues" } } },
    },
    intro: { type: "Text", props: { text: "WORKSPACE INITIATIVES", variant: "eyebrow" } },
    cards: {
      type: "Grid",
      props: { variant: "projects" },
      repeat: { statePath: "/projects", key: "id" },
      children: ["card"],
    },
    card: {
      type: "ProjectCard",
      props: { project: item("") },
      children: ["progress"],
      on: { open: { action: "navigate", params: { view: "issues", projectPath: item("id") } } },
    },
    progress: {
      type: "ProgressIndicator",
      props: { value: item("progress"), label: "Milestone progress" },
    },
    footer: {
      type: "Text",
      props: {
        text: "Select a project to explore its issues. Progress reflects the current project milestone.",
        variant: "caption",
      },
    },
  },
};

export const viewSpecs: Record<string, Spec> = {
  "my-issues": issuesView(true),
  "all-issues": issuesView(false),
  projects: projectView,
  "issue-detail": detail,
};

// Validate the same allowlist that the client registry implements before serving.
export function getViewSpec(view: string): Spec | undefined {
  const spec = viewSpecs[view];
  if (!spec) return undefined;
  const normalized = {
    ...spec,
    elements: Object.fromEntries(
      Object.entries(spec.elements).map(([id, element]) => [
        id,
        { ...element, children: element.children ?? [] },
      ]),
    ),
  };
  return validateViewSpec(normalized);
}
