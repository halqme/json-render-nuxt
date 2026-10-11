import { h } from "vue";
import { UAvatar, UIcon, UTooltip } from "#components";
import { people } from "../../../shared/mock-data";
import type { IssueStatus } from "../../../shared/types";

export const statusIcons: Record<IssueStatus, string> = {
  Backlog: "i-lucide-circle-dashed",
  Todo: "i-lucide-circle",
  "In progress": "i-lucide-circle-dot",
  "In review": "i-lucide-circle-ellipsis",
  Done: "i-lucide-circle-check",
};
export const statusClass = (status: string) =>
  `status-${status.toLowerCase().replaceAll(" ", "-")}`;
export const icon = (name: string, className = "") =>
  h(UIcon, { name, class: `jr-icon ${className}`, "aria-hidden": true });
export function avatar(id: string) {
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
                style: { background: `${person.color}28` },
              }),
            ]),
        },
      )
    : h("span", { class: "unassigned", title: "Unassigned" }, [
        icon("i-lucide-user-round"),
        h("span", { class: "sr-only" }, "Unassigned"),
      ]);
}
export const priorityIcon = (priority: string) =>
  ({
    Urgent: "i-lucide-circle-alert",
    High: "i-lucide-signal-high",
    Medium: "i-lucide-signal-medium",
    Low: "i-lucide-signal-low",
  })[priority] ?? "i-lucide-minus";
export const safeOptions = (options: { label: string; value: string }[]) =>
  options.map((o) => ({ ...o, value: o.value || "__empty" }));
export const date = (value: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
