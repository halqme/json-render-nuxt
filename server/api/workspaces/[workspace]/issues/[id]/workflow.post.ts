import { defineEventHandler, getRouterParam, readBody } from "h3";
import {
  mutateRecords,
  validate,
  workflowSchema,
  workspaceSchema,
} from "../../../../../utils/records";
import {
  getDemoPersona,
  performWorkflowAction,
  visibleRecords,
} from "../../../../../utils/personas";

export default defineEventHandler(async (event) => {
  const workspace = validate(workspaceSchema, getRouterParam(event, "workspace"));
  const persona = getDemoPersona(event);
  const id = getRouterParam(event, "id") || "";
  const { records, result: issue } = await mutateRecords(
    workspace,
    readBody(event).then((body) => validate(workflowSchema, body)),
    (records, action) => performWorkflowAction(records, persona, id, action.action),
  );
  return { ...visibleRecords(persona, records), issue };
});
