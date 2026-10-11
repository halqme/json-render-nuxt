import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/vue/schema";
import { z } from "zod";
import { priorities, statuses } from "./types";

export const workflowActions = ["start-work", "request-review", "approve"] as const;
const option = z.object({ label: z.string(), value: z.string() });
const issue = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(statuses),
  priority: z.enum(priorities),
  assignee: z.string(),
  project: z.string(),
  labels: z.array(z.string()),
  createdAt: z.string(),
});
const activity = z.object({
  id: z.string(),
  issueId: z.string(),
  author: z.string(),
  text: z.string(),
  createdAt: z.string(),
  type: z.enum(["comment", "change"]),
});
const person = z.object({
  id: z.string(),
  name: z.string(),
  initials: z.string(),
  color: z.string(),
});
const project = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  status: z.string(),
  team: z.string(),
  lead: z.string(),
  progress: z.number(),
  targetDate: z.string(),
  color: z.string(),
  icon: z.string(),
  issueCount: z.number(),
});

/** Allowlisted atomic building blocks and actions for all server-composed views. */
export const catalog = defineCatalog(schema, {
  components: {
    PageLayout: {
      props: z.object({}),
      slots: ["default"],
      description: "Shared main view page frame",
    },
    PageHeader: {
      props: z.object({
        view: z.string(),
        count: z.number(),
        projectFilter: z.string(),
        projects: z.array(project.passthrough()),
      }),
      slots: ["default"],
      description: "Issue or project page title, subtitle, and action slot",
    },
    PageActionButton: {
      props: z.object({ label: z.string(), icon: z.string(), primary: z.boolean().optional() }),
      events: ["press"],
      description: "A page-level action button",
    },
    NewIssueButton: {
      props: z.object({}),
      events: ["press"],
      description: "Open the existing lazy new-issue dialog",
    },
    IssueFilters: {
      props: z.object({
        query: z.string(),
        statusFilter: z.string(),
        priorityFilter: z.string(),
        assigneeFilter: z.string(),
        tab: z.string(),
        statuses: z.array(option),
        priorities: z.array(option),
        assignees: z.array(option),
      }),
      events: ["reset"],
      description: "Bound issue query, status, priority, assignee and scope controls",
    },
    IssueListSummary: {
      props: z.object({
        filteredCount: z.number(),
        totalCount: z.number(),
        selectedIds: z.array(z.string()),
      }),
      description: "Filtered, total and selected issue counts",
    },
    IssueGroup: {
      props: z.object({ status: z.enum(statuses), count: z.number() }),
      slots: ["default"],
      description: "One status group containing repeated issue rows",
    },
    RepeatContainer: {
      props: z.object({}),
      slots: ["default"],
      description: "Semantic-neutral container for repeated catalog children",
    },
    IssueRow: {
      props: z.object({
        issue,
        people: z.array(person),
        projects: z.array(project.passthrough()),
        selectedIds: z.array(z.string()),
      }),
      events: ["open", "toggle"],
      description: "One keyboard-accessible issue row",
    },
    EmptyIssueState: {
      props: z.object({}),
      events: ["reset"],
      description: "No matching issues message and filter reset control",
    },
    ProjectIntro: {
      props: z.object({ text: z.string() }),
      description: "Projects section eyebrow",
    },
    ProjectGrid: {
      props: z.object({}),
      slots: ["default"],
      description: "Responsive grid for repeated project cards",
    },
    ProjectCard: {
      props: z.object({ project, people: z.array(person) }),
      events: ["open"],
      description: "One project overview card with issue navigation",
    },
    EmptyProjectNotice: {
      props: z.object({ text: z.string() }),
      description: "Empty projects notice",
    },
    PageCaption: {
      props: z.object({ text: z.string() }),
      description: "Supporting page caption",
    },
    DetailLayout: {
      props: z.object({}),
      slots: ["default"],
      description: "Issue detail page frame",
    },
    DetailColumns: {
      props: z.object({}),
      slots: ["default", "sidebar"],
      description: "Main activity column and properties sidebar",
    },
    DetailBackButton: {
      props: z.object({}),
      events: ["press"],
      description: "Return to issue list",
    },
    IssueHeading: { props: z.object({ issue }), description: "Issue identity, title and labels" },
    IssueDescription: {
      props: z.object({ description: z.string() }),
      description: "Issue description section",
    },
    IssueActivity: {
      props: z.object({}),
      slots: ["default"],
      description: "Activity section containing individually repeated activity items",
    },
    ActivityItem: {
      props: z.object({ activity, people: z.array(person) }),
      description: "One activity or comment row",
    },
    EmptyActivityNotice: {
      props: z.object({ text: z.string() }),
      description: "Notice shown when no activity exists",
    },
    CommentComposer: {
      props: z.object({ modelValue: z.string() }),
      events: ["post"],
      description: "Bound draft comment and posting control",
    },
    ReadOnlyNotice: {
      props: z.object({ text: z.string() }),
      description: "Read-only access notice",
    },
    IssueProperties: {
      props: z.object({}),
      slots: ["default"],
      description: "Issue properties section",
    },
    PropertyValue: {
      props: z.object({
        label: z.string(),
        value: z.string(),
        field: z.enum(["status", "priority", "assignee", "project"]),
        options: z.array(z.object({ id: z.string(), name: z.string() }).passthrough()),
      }),
      description: "Read-only property row",
    },
    PropertyEditor: {
      props: z.object({
        label: z.string(),
        field: z.enum(["priority", "assignee", "project"]),
        value: z.string(),
        options: z.array(z.object({ id: z.string(), name: z.string() }).passthrough()),
      }),
      events: ["change"],
      description: "Bound editable issue property selector",
    },
    WorkflowPanel: {
      props: z.object({ issueId: z.string() }),
      slots: ["default"],
      description: "Container for the current issue's workflow guidance and available action",
    },
    PanelMessage: {
      props: z.object({ text: z.string() }),
      description: "Workflow state explanation",
    },
    WorkflowStatus: {
      props: z.object({ status: z.enum(statuses) }),
      description: "Current workflow status",
    },
    WorkflowButton: {
      props: z.object({ action: z.enum(workflowActions), label: z.string() }),
      events: ["advance"],
      description: "A server-authorized workflow action",
    },
  },
  actions: {
    navigateToIssues: { params: z.object({}), description: "Show the issues list" },
    openNewIssue: { params: z.object({}), description: "Open the new-issue dialog" },
    resetFilters: { params: z.object({}), description: "Clear issue filters and selection" },
    openIssue: { params: z.object({ issueId: z.string() }), description: "Open an issue" },
    toggleIssueSelection: {
      params: z.object({ issueId: z.string() }),
      description: "Toggle an issue's selected state",
    },
    openProject: {
      params: z.object({ projectId: z.string() }),
      description: "Show a project's issues",
    },
    backToIssues: { params: z.object({}), description: "Close the current issue detail" },
    addComment: { params: z.object({}), description: "Post the bound issue comment draft" },
    changeProperty: {
      params: z.object({ field: z.enum(["priority", "assignee", "project"]), value: z.string() }),
      description: "Validate and save an issue property change",
    },
    workflowAction: {
      params: z.object({ action: z.enum(workflowActions) }),
      description: "Request a server-validated workflow transition",
    },
  },
});
