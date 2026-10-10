import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/vue/schema";
import { z } from "zod";
import { statuses, priorities } from "./types";

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

/** Shared allowlist and prop contracts for authored server-driven screens. */
export const catalog = defineCatalog(schema, {
  components: {
    Stack: {
      props: z.object({
        variant: z.enum(["page", "groups", "rows", "detail", "activity", "plain"]).optional(),
      }),
      slots: ["default"],
      description: "Vertical layout with a consistent density",
    },
    Grid: {
      props: z.object({ variant: z.enum(["projects", "detail"]) }),
      slots: ["default"],
      description: "Responsive grid",
    },
    Section: {
      props: z.object({ title: z.string().optional(), variant: z.string().optional() }),
      slots: ["default"],
      description: "A semantic content section",
    },
    PageHeader: {
      props: z.object({
        title: z.string(),
        subtitle: z.string(),
        icon: z.string(),
        count: z.number().optional(),
      }),
      slots: ["default"],
      description: "View heading with trailing actions",
    },
    Toolbar: {
      props: z.object({}),
      slots: ["default"],
      description: "Wrapping filter and search toolbar",
    },
    Text: {
      props: z.object({
        text: z.string(),
        variant: z.enum(["body", "title", "caption", "eyebrow"]).optional(),
      }),
      description: "Readable text",
    },
    Button: {
      props: z.object({
        label: z.string(),
        icon: z.string().optional(),
        variant: z.enum(["primary", "secondary", "ghost"]).optional(),
      }),
      events: ["press"],
      description: "Action button",
    },
    SearchField: {
      props: z.object({ value: z.string(), placeholder: z.string() }),
      description: "Two-way bound search input",
    },
    SelectField: {
      props: z.object({
        value: z.string(),
        label: z.string(),
        options: z.array(option),
        icon: z.string().optional(),
      }),
      description: "Two-way bound filter",
    },
    Tabs: {
      props: z.object({ value: z.string(), options: z.array(option) }),
      description: "Bound view segments",
    },
    IssueGroup: {
      props: z.object({ status: z.enum(statuses), count: z.number() }),
      slots: ["default"],
      description: "Status group, with item repetition authored in the Spec",
    },
    IssueRow: {
      props: z.object({ issue }),
      events: ["open", "select"],
      description: "Dense issue row with priority, project and assignee",
    },
    ListSummary: {
      props: z.object({ count: z.number(), total: z.number() }),
      description: "Result and selection count",
    },
    EmptyState: {
      props: z.object({ title: z.string(), description: z.string(), icon: z.string() }),
      slots: ["default"],
      description: "Recoverable empty state",
    },
    IssueHeading: {
      props: z.object({ id: z.string(), title: z.string(), labels: z.array(z.string()) }),
      description: "Issue identity and title",
    },
    PropertyField: {
      props: z.object({
        label: z.string(),
        field: z.enum(["status", "priority", "assignee", "project"]),
        value: z.string(),
        options: z.array(option),
      }),
      events: ["change"],
      description: "Editable issue property; dispatches the Spec action after binding changes",
    },
    ActivityItem: {
      props: z.object({
        activity: z.object({
          id: z.string(),
          issueId: z.string(),
          author: z.string(),
          text: z.string(),
          createdAt: z.string(),
          type: z.enum(["comment", "change"]),
        }),
      }),
      description: "A comment or property-change event",
    },
    CommentField: {
      props: z.object({ value: z.string(), placeholder: z.string() }),
      description: "Bound comment draft",
    },
    ProjectCard: {
      props: z.object({ project }),
      events: ["open"],
      slots: ["default"],
      description: "Project overview, owner and milestone",
    },
    ProgressIndicator: {
      props: z.object({ value: z.number(), label: z.string() }),
      description: "Accessible completion indicator",
    },
  },
  actions: {
    openIssue: {
      params: z.object({ id: z.string().optional(), idPath: z.string().optional() }),
      description: "Open or close an issue using a literal ID or repeat-item pointer",
    },
    toggleSelection: {
      params: z.object({ idPath: z.string() }),
      description: "Toggle an issue selection",
    },
    newIssue: { params: z.object({}), description: "Open the issue composer" },
    resetFilters: { params: z.object({}), description: "Clear all filters" },
    navigate: {
      params: z.object({
        view: z.string(),
        project: z.string().optional(),
        projectPath: z.string().optional(),
      }),
      description: "Navigate to a view or project scope",
    },
    changeProperty: {
      params: z.object({ field: z.string(), value: z.string() }),
      description: "Update a property and append history",
    },
    addComment: { params: z.object({}), description: "Post the bound draft comment" },
  },
});
