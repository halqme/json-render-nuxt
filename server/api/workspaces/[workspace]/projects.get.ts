import { defineEventHandler, getRouterParam, setHeader } from "h3";
import { loadRecords, validate, workspaceSchema } from "../../../utils/records";
import { getDemoPersona, visibleProjectRecords } from "../../../utils/personas";

export default defineEventHandler((event) => {
  const workspace = validate(workspaceSchema, getRouterParam(event, "workspace"));
  setHeader(event, "Cache-Control", "no-store");
  return visibleProjectRecords(getDemoPersona(event), loadRecords(workspace));
});
