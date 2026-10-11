import { defineEventHandler, getRouterParam, readBody } from "h3";
import {
  createIssue,
  createSchema,
  mutateRecords,
  validate,
  workspaceSchema,
} from "../../../utils/records";
import { getDemoPersona, requireWritablePersona, visibleRecords } from "../../../utils/personas";

export default defineEventHandler(async (event) => {
  const workspace = validate(workspaceSchema, getRouterParam(event, "workspace"));
  const persona = getDemoPersona(event);
  const { records, result: issue } = await mutateRecords(
    workspace,
    readBody(event).then((body) => validate(createSchema, body)),
    (records, input) => createIssue(records, input, requireWritablePersona(persona)),
  );
  return { ...visibleRecords(persona, records), issue };
});
