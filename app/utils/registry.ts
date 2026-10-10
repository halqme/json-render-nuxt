import { h } from "vue";
import { defineRegistry, useBoundProp, useStateStore } from "@json-render/vue";
import {
  UButton,
  UIcon,
  UInput,
  USelect,
  UAvatar,
  UBadge,
  UTextarea,
  UProgress,
  UTooltip,
} from "#components";
import { catalog } from "../../shared/catalog";
import { people, projects } from "../../shared/mock-data";
import type { IssueStatus } from "../../shared/types";

const statusIcons: Record<IssueStatus, string> = {
  Backlog: "i-lucide-circle-dashed",
  Todo: "i-lucide-circle",
  "In progress": "i-lucide-circle-dot",
  "In review": "i-lucide-circle-ellipsis",
  Done: "i-lucide-circle-check",
};
const statusClass = (status: string) => `status-${status.toLowerCase().replaceAll(" ", "-")}`;
const icon = (name: string, className = "") =>
  h(UIcon, { name, class: `jr-icon ${className}`, "aria-hidden": true });
function avatar(id: string) {
  const person = people.find((p) => p.id === id);
  return person
    ? h(
        UTooltip,
        { text: person.name },
        {
          default: () =>
            h("span", { tabindex: 0, class: "person-avatar", "aria-label": person.name }, [
              h(UAvatar, {
                text: person.initials,
                alt: person.name,
                size: "2xs",
                style: { background: `${person.color}28`, color: "#eee" },
              }),
            ]),
        },
      )
    : h("span", { class: "unassigned", title: "Unassigned" }, [
        icon("i-lucide-user-round"),
        h("span", { class: "sr-only" }, "Unassigned"),
      ]);
}
const priorityIcon = (priority: string) =>
  ({
    Urgent: "i-lucide-circle-alert",
    High: "i-lucide-signal-high",
    Medium: "i-lucide-signal-medium",
    Low: "i-lucide-signal-low",
  })[priority] ?? "i-lucide-minus";
const safeOptions = (options: { label: string; value: string }[]) =>
  options.map((o) => ({ ...o, value: o.value || "__empty" }));
const date = (value: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));

export function createTrackerRegistry(handlers: {
  openIssue: (params: Record<string, unknown>) => unknown;
  toggleSelection: (params: Record<string, unknown>) => unknown;
  newIssue: () => void;
  resetFilters: () => void;
  navigate: (params: Record<string, unknown>) => unknown;
  changeProperty: (params: Record<string, unknown>) => void;
  addComment: () => void;
}) {
  return defineRegistry(catalog, {
    components: {
      Stack: ({ props, children }) =>
        h("div", { class: `jr-stack jr-stack-${props.variant ?? "plain"}` }, children),
      Grid: ({ props, children }) =>
        h("div", { class: `jr-grid jr-grid-${props.variant}` }, children),
      Section: ({ props, children }) =>
        h("section", { class: `jr-section jr-section-${props.variant ?? "plain"}` }, [
          props.title ? h("h2", { class: "jr-section-title" }, props.title) : null,
          children,
        ]),
      PageHeader: ({ props, children }) =>
        h("header", { class: "jr-page-header" }, [
          h("div", { class: "jr-page-heading" }, [
            h("div", { class: "jr-title-line" }, [
              icon(props.icon, "jr-heading-icon"),
              h("h1", null, props.title),
              props.count !== undefined
                ? h("span", { class: "jr-count" }, String(props.count))
                : null,
            ]),
            h("p", null, props.subtitle),
          ]),
          h("div", { class: "jr-header-actions" }, children),
        ]),
      Toolbar: ({ children }) =>
        h("div", { class: "jr-toolbar", role: "search", "aria-label": "Filter issues" }, children),
      Text: ({ props }) =>
        h(
          "p",
          { class: `jr-text jr-text-${props.variant ?? "body"}` },
          props.text || (props.variant === "body" ? "No description provided." : ""),
        ),
      Button: ({ props, emit }) =>
        h(UButton, {
          label: props.label,
          icon: props.icon,
          size: "sm",
          color: props.variant === "primary" ? "primary" : "neutral",
          variant:
            props.variant === "primary" ? "solid" : props.variant === "ghost" ? "ghost" : "outline",
          class: "jr-button",
          onClick: () => emit("press"),
        }),
      SearchField: ({ props, bindings }) => {
        const [value, set] = useBoundProp<string>(props.value, bindings?.value);
        return h(UInput<string, {}>, {
          modelValue: value,
          "onUpdate:modelValue": (v: string) => set(v),
          icon: "i-lucide-search",
          placeholder: props.placeholder,
          "aria-label": "Search issues",
          size: "sm",
          color: "neutral",
          class: "jr-search",
          ui: { base: "w-full" },
        });
      },
      SelectField: ({ props, bindings }) => {
        const [value, set] = useBoundProp<string>(props.value, bindings?.value);
        return h(USelect, {
          modelValue: value || "__empty",
          "onUpdate:modelValue": (v: string) => set(v === "__empty" ? "" : v),
          items: safeOptions(props.options),
          icon: props.icon,
          "aria-label": props.label,
          size: "sm",
          color: "neutral",
          class: "jr-filter",
          ui: { base: value ? "ring-violet-400/50" : "" },
        });
      },
      Tabs: ({ props, bindings }) => {
        const [value, set] = useBoundProp<string>(props.value, bindings?.value);
        return h(
          "div",
          { class: "jr-tabs", role: "group", "aria-label": "Issue scope" },
          props.options.map((o) =>
            h(UButton, {
              label: o.label,
              color: "neutral",
              variant: "ghost",
              size: "sm",
              class: ["jr-tab", { active: value === o.value }],
              "aria-pressed": value === o.value,
              onClick: () => set(o.value),
            }),
          ),
        );
      },
      IssueGroup: ({ props, children }) =>
        h("section", { class: "jr-issue-group", "aria-label": props.status }, [
          h("div", { class: "jr-group-heading" }, [
            icon(statusIcons[props.status], statusClass(props.status)),
            h("h2", null, props.status),
            h("span", { class: "jr-group-count" }, String(props.count)),
          ]),
          children,
        ]),
      IssueRow: ({ props, emit }) => {
        const issue = props.issue;
        const { state } = useStateStore();
        const selected = (state.value.selectedIds as string[]).includes(issue.id);
        const project = projects.find((p) => p.id === issue.project);
        return h(
          "div",
          { class: ["jr-issue-row", { "is-selected": selected }], "data-issue-id": issue.id },
          [
            h("input", {
              type: "checkbox",
              checked: selected,
              "aria-label": `Select ${issue.id}`,
              class: "jr-row-checkbox",
              onChange: () => emit("select"),
            }),
            h(
              "button",
              {
                type: "button",
                class: "jr-issue-link",
                onClick: () => emit("open"),
                "aria-label": `${issue.id}: ${issue.title}`,
              },
              [
                icon(
                  priorityIcon(issue.priority),
                  `jr-priority priority-${issue.priority.toLowerCase()}`,
                ),
                h("span", { class: "jr-issue-id" }, issue.id),
                icon(statusIcons[issue.status], statusClass(issue.status)),
                h("span", { class: "jr-issue-title" }, issue.title),
                h("span", { class: "jr-row-label" }, issue.labels[0] ?? ""),
              ],
            ),
            h("span", { class: "jr-row-priority" }, issue.priority),
            h(
              "span",
              { class: "jr-row-project" },
              project ? [icon(project.icon), project.name] : "—",
            ),
            avatar(issue.assignee),
          ],
        );
      },
      ListSummary: ({ props }) => {
        const { state } = useStateStore();
        const count = (state.value.selectedIds as string[]).length;
        return h("div", { class: "jr-list-summary" }, [
          h(
            "span",
            null,
            `${props.count} of ${props.total} issues${count ? ` · ${count} selected` : ""}`,
          ),
          h("span", { class: "jr-summary-meta" }, [
            icon("i-lucide-list-filter"),
            "Grouped by status",
          ]),
        ]);
      },
      EmptyState: ({ props, children }) =>
        h("section", { class: "jr-empty", role: "status" }, [
          icon(props.icon),
          h("h2", null, props.title),
          h("p", null, props.description),
          children,
        ]),
      IssueHeading: ({ props }) =>
        h("header", { class: "jr-issue-heading" }, [
          h("div", { class: "jr-issue-kicker" }, [
            icon("i-lucide-command"),
            props.id,
            h("span", null, "Engineering"),
          ]),
          h("h1", null, props.title),
          h(
            "div",
            { class: "jr-labels" },
            props.labels.map((label) =>
              h(UBadge, { label, color: "neutral", variant: "subtle", size: "sm" }),
            ),
          ),
        ]),
      PropertyField: ({ props, bindings, emit }) => {
        const [value, set] = useBoundProp<string>(props.value, bindings?.value);
        return h("div", { class: "jr-property" }, [
          h("span", { class: "jr-property-label" }, props.label),
          h(USelect, {
            modelValue: value || "__empty",
            "onUpdate:modelValue": (v: string) => {
              set(v === "__empty" ? "" : v);
              emit("change");
            },
            items: safeOptions(props.options),
            "aria-label": `Change ${props.label.toLowerCase()}`,
            size: "sm",
            color: "neutral",
            class: "jr-property-select",
            icon:
              props.field === "status"
                ? statusIcons[props.value as IssueStatus]
                : props.field === "priority"
                  ? priorityIcon(props.value)
                  : props.field === "assignee"
                    ? "i-lucide-user-round"
                    : "i-lucide-box",
          }),
        ]);
      },
      ActivityItem: ({ props }) => {
        const a = props.activity;
        const author = people.find((p) => p.id === a.author);
        return h("article", { class: ["jr-activity-item", `jr-activity-${a.type}`] }, [
          avatar(a.author),
          h("div", { class: "jr-activity-content" }, [
            h("div", { class: "jr-activity-meta" }, [
              h("strong", null, author?.name ?? "Teammate"),
              h("time", { datetime: a.createdAt }, date(a.createdAt)),
            ]),
            h("p", null, a.text),
          ]),
        ]);
      },
      CommentField: ({ props, bindings }) => {
        const [value, set] = useBoundProp<string>(props.value, bindings?.value);
        return h(UTextarea<string>, {
          modelValue: value,
          "onUpdate:modelValue": (v: string) => set(v),
          placeholder: props.placeholder,
          "aria-label": "Comment",
          rows: 3,
          autoresize: true,
          color: "neutral",
          class: "jr-comment-input",
        });
      },
      ProjectCard: ({ props, emit, children }) => {
        const p = props.project;
        return h("article", { class: "jr-project-card" }, [
          h("div", { class: "jr-project-top" }, [
            h(
              "span",
              { class: "jr-project-icon", style: { color: p.color, background: `${p.color}18` } },
              [icon(p.icon)],
            ),
            h(UBadge, { label: p.status, variant: "subtle", color: "neutral", size: "sm" }),
          ]),
          h(
            "button",
            {
              class: "jr-project-link",
              type: "button",
              onClick: () => emit("open"),
              "aria-label": `Open ${p.name} issues`,
            },
            [h("h2", null, p.name), icon("i-lucide-arrow-up-right")],
          ),
          h("p", { class: "jr-project-description" }, p.description),
          h("div", { class: "jr-project-team" }, [
            icon("i-lucide-users"),
            p.team,
            h("span", { class: "jr-project-lead" }, [avatar(p.lead)]),
          ]),
          children,
          h("div", { class: "jr-project-footer" }, [
            h("button", { type: "button", onClick: () => emit("open") }, `${p.issueCount} issues`),
            h("span", null, [icon("i-lucide-calendar-days"), date(p.targetDate)]),
          ]),
        ]);
      },
      ProgressIndicator: ({ props }) =>
        h("div", { class: "jr-progress" }, [
          h("div", { class: "jr-progress-label" }, [
            props.label,
            h("span", null, `${props.value}%`),
          ]),
          h(UProgress, {
            modelValue: props.value,
            max: 100,
            size: "xs",
            color: "primary",
            "aria-label": props.label,
          }),
        ]),
    },
    actions: {
      openIssue: async (params) => {
        await handlers.openIssue(params ?? {});
      },
      toggleSelection: async (params) => {
        handlers.toggleSelection(params ?? {});
      },
      newIssue: async () => {
        handlers.newIssue();
      },
      resetFilters: async () => {
        handlers.resetFilters();
      },
      navigate: async (params) => {
        await handlers.navigate(params ?? {});
      },
      changeProperty: async (params) => {
        handlers.changeProperty(params ?? {});
      },
      addComment: async () => {
        handlers.addComment();
      },
    },
  });
}
