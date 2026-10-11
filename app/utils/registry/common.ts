import { h } from "vue";
import { useBoundProp, type Components } from "@json-render/vue";
import { UButton, UInput, USelect } from "#components";
import type { catalog } from "../../../shared/catalog";
import { icon, safeOptions } from "./presentation";

export const commonComponents = {
  Stack: ({ props, children }) =>
    h("div", { class: `jr-stack jr-stack-${props.variant ?? "plain"}` }, children),
  Grid: ({ props, children }) => h("div", { class: `jr-grid jr-grid-${props.variant}` }, children),
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
          props.count !== undefined ? h("span", { class: "jr-count" }, String(props.count)) : null,
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
  EmptyState: ({ props, children }) =>
    h("section", { class: "jr-empty", role: "status" }, [
      icon(props.icon),
      h("h2", null, props.title),
      h("p", null, props.description),
      children,
    ]),
} satisfies Pick<
  Components<typeof catalog>,
  | "Stack"
  | "Grid"
  | "Section"
  | "PageHeader"
  | "Toolbar"
  | "Text"
  | "Button"
  | "SearchField"
  | "SelectField"
  | "Tabs"
  | "EmptyState"
>;
