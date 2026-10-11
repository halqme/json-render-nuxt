import { h } from "vue";
import { useStateStore, type Components } from "@json-render/vue";
import { projects } from "../../../shared/mock-data";
import type { catalog } from "../../../shared/catalog";
import { avatar, icon, priorityIcon, statusClass, statusIcons } from "./presentation";

export const issuesComponents = {
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
        h("span", { class: "jr-row-project" }, project ? [icon(project.icon), project.name] : "—"),
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
      h("span", { class: "jr-summary-meta" }, [icon("i-lucide-list-filter"), "Grouped by status"]),
    ]);
  },
} satisfies Pick<Components<typeof catalog>, "IssueGroup" | "IssueRow" | "ListSummary">;
