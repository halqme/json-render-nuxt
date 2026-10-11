import { h } from "vue";
import type { Components } from "@json-render/vue";
import { UBadge, UProgress } from "#components";
import type { catalog } from "../../../shared/catalog";
import { avatar, date, icon } from "./presentation";

export const projectsComponents = {
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
      h("div", { class: "jr-progress-label" }, [props.label, h("span", null, `${props.value}%`)]),
      h(UProgress, {
        modelValue: props.value,
        max: 100,
        size: "xs",
        color: "primary",
        "aria-label": props.label,
      }),
    ]),
} satisfies Pick<Components<typeof catalog>, "ProjectCard" | "ProgressIndicator">;
