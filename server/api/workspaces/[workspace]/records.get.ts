import { defineEventHandler, getRouterParam, setHeader } from "h3";
import { loadRecords, validate, workspaceSchema } from "../../../utils/records";
import { getDemoPersona, visibleRecords } from "../../../utils/personas";

export default defineEventHandler((event) => {
  const workspace = validate(workspaceSchema, getRouterParam(event, "workspace"));
  setHeader(event, "Cache-Control", "no-store");
  return visibleRecords(getDemoPersona(event), loadRecords(workspace));
});
