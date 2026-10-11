import { h } from "vue";
import { defineRegistry, useBoundProp } from "@json-render/vue";
import type { Components } from "@json-render/vue";
import { UBadge, UButton, UIcon, USelect } from "#components";
import { catalog } from "../../shared/catalog";
import ActivityItem from "../components/tracker/ActivityItem.vue";
import CommentComposer from "../components/tracker/CommentComposer.vue";
import IssueActivity from "../components/tracker/IssueActivity.vue";
import IssueDescription from "../components/tracker/IssueDescription.vue";
import IssueFilters from "../components/tracker/IssueFilters.vue";
import IssueGroup from "../components/tracker/IssueGroup.vue";
import IssueHeading from "../components/tracker/IssueHeading.vue";
import IssueProperties from "../components/tracker/IssueProperties.vue";
import IssueRow from "../components/tracker/IssueRow.vue";
import PageActionButton from "../components/tracker/PageActionButton.vue";
import PageHeader from "../components/tracker/PageHeader.vue";
import ProjectCard from "../components/tracker/ProjectCard.vue";

type TrackerHandlers = {
  navigateToIssues: () => unknown;
  openNewIssue: () => unknown;
  resetFilters: () => unknown;
  openIssue: (issueId: string) => unknown;
  toggleIssueSelection: (issueId: string) => unknown;
  openProject: (projectId: string) => unknown;
  workflowAction: (params: Record<string, unknown>) => unknown;
  backToIssues: () => unknown;
  addComment: () => unknown;
  changeProperty: (params: Record<string, unknown>) => unknown;
};

export function createTrackerRegistry(handlers: TrackerHandlers) {
  return defineRegistry(catalog, {
    components: {
      PageLayout: ({ children }) => h("div", { class: "jr-stack jr-stack-page" }, children),
      PageHeader: ({ props, slots }) =>
        h(
          PageHeader,
          {
            view: props.view,
            count: props.count,
            projectFilter: props.projectFilter,
            projects: props.projects,
          },
          slots,
        ),
      PageActionButton: ({ props, emit }) =>
        h(PageActionButton, {
          label: props.label,
          icon: props.icon,
          primary: props.primary,
          onPress: () => emit("press"),
        }),
      NewIssueButton: ({ emit }) =>
        h(UButton, {
          label: "New issue",
          icon: "i-lucide-plus",
          color: "primary",
          onClick: () => emit("press"),
        }),
      IssueFilters: ({ props, bindings, emit }) => {
        const [query, setQuery] = useBoundProp(props.query, bindings?.query);
        const [statusFilter, setStatus] = useBoundProp(props.statusFilter, bindings?.statusFilter);
        const [priorityFilter, setPriority] = useBoundProp(
          props.priorityFilter,
          bindings?.priorityFilter,
        );
        const [assigneeFilter, setAssignee] = useBoundProp(
          props.assigneeFilter,
          bindings?.assigneeFilter,
        );
        const [tab, setTab] = useBoundProp(props.tab, bindings?.tab);
        return h(IssueFilters, {
          query: query ?? "",
          statusFilter: statusFilter ?? "",
          priorityFilter: priorityFilter ?? "",
          assigneeFilter: assigneeFilter ?? "",
          tab: tab ?? "all",
          statuses: props.statuses,
          priorities: props.priorities,
          assignees: props.assignees,
          "onUpdate:query": setQuery,
          "onUpdate:statusFilter": (value: string) => setStatus(value === "all" ? "" : value),
          "onUpdate:priorityFilter": (value: string) => setPriority(value === "all" ? "" : value),
          "onUpdate:assigneeFilter": (value: string) => setAssignee(value === "all" ? "" : value),
          "onUpdate:tab": setTab,
          onReset: () => emit("reset"),
        });
      },
      IssueListSummary: ({ props }) =>
        h("div", { class: "jr-list-summary" }, [
          h("span", null, [
            `${props.filteredCount} of ${props.totalCount} issues`,
            props.selectedIds.length ? ` · ${props.selectedIds.length} selected` : "",
          ]),
          h("span", { class: "jr-summary-meta" }, [
            h(UIcon, { name: "i-lucide-list-filter", class: "jr-icon", "aria-hidden": "true" }),
            "Grouped by status",
          ]),
        ]),
      IssueGroup: ({ props, children }) =>
        h(IssueGroup, { status: props.status, count: props.count }, { default: () => children }),
      RepeatContainer: ({ children }) => h("div", null, children),
      IssueRow: ({ props, emit }) =>
        h(IssueRow, {
          issue: props.issue,
          people: props.people,
          projects: props.projects,
          selectedIds: props.selectedIds,
          onOpen: () => emit("open"),
          onToggle: () => emit("toggle"),
        }),
      EmptyIssueState: ({ emit }) =>
        h("section", { class: "jr-empty", role: "status" }, [
          h(UIcon, { name: "i-lucide-search-x", class: "jr-icon", "aria-hidden": "true" }),
          h("h2", null, "No issues found"),
          h("p", null, "Try a different search or reset your filters to see more work."),
          h(UButton, {
            label: "Reset filters",
            color: "neutral",
            variant: "outline",
            onClick: () => emit("reset"),
          }),
        ]),
      ProjectIntro: ({ props }) => h("p", { class: "jr-text-eyebrow" }, props.text),
      ProjectGrid: ({ children }) => h("div", { class: "jr-grid-projects" }, children),
      ProjectCard: ({ props, emit }) =>
        h(ProjectCard, {
          project: props.project,
          people: props.people,
          onOpen: () => emit("open"),
        }),
      EmptyProjectNotice: ({ props }) => h("p", { class: "jr-text-caption" }, props.text),
      PageCaption: ({ props }) => h("p", { class: "jr-text-caption" }, props.text),
      DetailLayout: ({ children }) => h("section", { class: "jr-stack jr-stack-detail" }, children),
      DetailColumns: ({ children, slots }) =>
        h("div", { class: "jr-grid-detail" }, [h("div", null, children), slots.sidebar?.()]),
      DetailBackButton: ({ emit }) =>
        h(UButton, {
          label: "Back to issues",
          icon: "i-lucide-arrow-left",
          color: "neutral",
          variant: "ghost",
          class: "jr-button",
          onClick: () => emit("press"),
        }),
      IssueHeading: ({ props }) => h(IssueHeading, { issue: props.issue }),
      IssueDescription: ({ props }) => h(IssueDescription, { description: props.description }),
      IssueActivity: ({ children }) => h(IssueActivity, null, { default: () => children }),
      ActivityItem: ({ props }) =>
        h(ActivityItem, { activity: props.activity, people: props.people }),
      EmptyActivityNotice: ({ props }) => h("p", { class: "jr-text-caption" }, props.text),
      CommentComposer: ({ props, bindings, emit }) => {
        const [draft, setDraft] = useBoundProp(props.modelValue, bindings?.modelValue);
        return h(CommentComposer, {
          modelValue: draft!,
          "onUpdate:modelValue": setDraft,
          onPost: () => emit("post"),
        });
      },
      ReadOnlyNotice: ({ props }) => h("p", { class: "jr-text-caption" }, props.text),
      IssueProperties: ({ children }) => h(IssueProperties, null, { default: () => children }),
      PropertyValue: ({ props }) => {
        const displayValue =
          props.options.find((option) => option.id === props.value)?.name ??
          (props.field === "assignee"
            ? "Unassigned"
            : props.field === "project"
              ? "No project"
              : props.value);
        return h("div", { class: "jr-property" }, [
          h("span", { class: "jr-property-label" }, props.label),
          h("span", null, displayValue),
        ]);
      },
      PropertyEditor: ({ props, bindings, emit }) => {
        const [bound, setBound] = useBoundProp(props.value, bindings?.value);
        const id = `issue-property-${props.field}`;
        const empty =
          props.field === "assignee"
            ? { label: "Unassigned", value: "__empty" }
            : { label: "No project", value: "__empty" };
        const options =
          props.field === "priority"
            ? ["Urgent", "High", "Medium", "Low"].map((value) => ({ label: value, value }))
            : [empty, ...props.options.map((option) => ({ label: option.name, value: option.id }))];
        return h("div", { class: "jr-property" }, [
          h("label", { class: "jr-property-label", for: id }, props.label),
          h(USelect, {
            id,
            modelValue:
              bound || (props.field === "assignee" || props.field === "project" ? "__empty" : ""),
            items: options,
            "aria-label": `Change ${props.label.toLowerCase()}`,
            size: "sm",
            color: "neutral",
            class: "jr-property-select",
            "onUpdate:modelValue": (value: string) => {
              setBound(value === "__empty" ? "" : value);
              emit("change");
            },
          }),
        ]);
      },
      WorkflowPanel: ({ props, children }) =>
        h("section", { class: "workflow-panel", "aria-label": "Issue workflow" }, [
          h("div", { class: "workflow-panel-heading" }, [
            h("div", null, [
              h("p", { class: "workflow-panel-eyebrow" }, `Workflow · ${props.issueId}`),
              h("h2", null, "Next action"),
            ]),
          ]),
          h("div", { class: "workflow-panel-content" }, children),
        ]),
      PanelMessage: ({ props }) => h("p", { class: "workflow-panel-message" }, props.text),
      WorkflowStatus: ({ props }) =>
        h(UBadge, {
          label: props.status,
          color: props.status === "Done" ? "success" : "neutral",
          variant: "subtle",
        }),
      WorkflowButton: ({ props, emit }) =>
        h(UButton, {
          label: props.label,
          icon: props.action === "approve" ? "i-lucide-check" : "i-lucide-arrow-right",
          color: "primary",
          onClick: () => emit("advance"),
        }),
    } satisfies Components<typeof catalog>,
    actions: {
      navigateToIssues: async () => {
        await handlers.navigateToIssues();
      },
      openNewIssue: async () => {
        await handlers.openNewIssue();
      },
      resetFilters: async () => {
        await handlers.resetFilters();
      },
      openIssue: async (params) => {
        const issueId = params?.issueId;
        if (typeof issueId === "string") await handlers.openIssue(issueId);
      },
      toggleIssueSelection: async (params) => {
        const issueId = params?.issueId;
        if (typeof issueId === "string") await handlers.toggleIssueSelection(issueId);
      },
      openProject: async (params) => {
        const projectId = params?.projectId;
        if (typeof projectId === "string") await handlers.openProject(projectId);
      },
      workflowAction: async (params) => {
        await handlers.workflowAction(params ?? {});
      },
      backToIssues: async () => {
        await handlers.backToIssues();
      },
      addComment: async () => {
        await handlers.addComment();
      },
      changeProperty: async (params) => {
        await handlers.changeProperty(params ?? {});
      },
    },
  });
}
