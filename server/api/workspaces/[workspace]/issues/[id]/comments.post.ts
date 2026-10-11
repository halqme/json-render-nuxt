import { defineEventHandler, getRouterParam, readBody } from "h3";
import {
  addComment,
  commentSchema,
  mutateRecords,
  validate,
  workspaceSchema,
} from "../../../../../utils/records";
import {
  getDemoPersona,
  requireReadableIssue,
  requireWritablePersona,
  visibleRecords,
} from "../../../../../utils/personas";

export default defineEventHandler(async (event) => {
  const workspace = validate(workspaceSchema, getRouterParam(event, "workspace"));
  const persona = getDemoPersona(event);
  const id = getRouterParam(event, "id") || "";
  const { records } = await mutateRecords(
    workspace,
    readBody(event).then((body) => validate(commentSchema, body)),
    (records, input) => {
      requireReadableIssue(records, persona, id);
      addComment(records, id, input.text, requireWritablePersona(persona));
    },
  );
  return visibleRecords(persona, records);
});
