import { defineEventHandler, getRouterParam, createError, setHeader } from "h3";
import { getViewSpec } from "../../utils/view-specs";

export default defineEventHandler((event) => {
  const view = getRouterParam(event, "view") ?? "";
  const spec = getViewSpec(view);
  if (!spec) throw createError({ statusCode: 404, statusMessage: "Unknown view" });
  setHeader(event, "Cache-Control", "no-cache");
  return spec;
});
