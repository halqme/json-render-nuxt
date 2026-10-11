import { defineRegistry } from "@json-render/vue";
import { catalog } from "../../shared/catalog";
import { commonComponents } from "./registry/common";
import { issuesComponents } from "./registry/issues";
import { detailComponents } from "./registry/detail";
import { projectsComponents } from "./registry/projects";

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
      ...commonComponents,
      ...issuesComponents,
      ...detailComponents,
      ...projectsComponents,
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
