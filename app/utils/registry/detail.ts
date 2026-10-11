import { h } from "vue";
import { useBoundProp, type Components } from "@json-render/vue";
import { UBadge, USelect, UTextarea } from "#components";
import { people } from "../../../shared/mock-data";
import type { IssueStatus } from "../../../shared/types";
import type { catalog } from "../../../shared/catalog";
import { avatar, date, icon, priorityIcon, safeOptions, statusIcons } from "./presentation";

export const detailComponents = {
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
} satisfies Pick<
  Components<typeof catalog>,
  "IssueHeading" | "PropertyField" | "ActivityItem" | "CommentField"
>;
