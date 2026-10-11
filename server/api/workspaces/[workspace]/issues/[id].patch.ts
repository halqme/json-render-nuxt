import { createError, defineEventHandler, getRouterParam, readBody } from "h3";
import {
  mutateRecords,
  updateIssue,
  updateSchema,
  validate,
  workspaceSchema,
} from "../../../../utils/records";
import {
  getDemoPersona,
  requireReadableIssue,
  requireWritablePersona,
  visibleRecords,
} from "../../../../utils/personas";

export default defineEventHandler(async (event) => {
  const workspace = validate(workspaceSchema, getRouterParam(event, "workspace"));
  const persona = getDemoPersona(event);
  const id = getRouterParam(event, "id") || "";
  const input = readBody(event).then((body) => {
    if (body && typeof body === "object" && Object.hasOwn(body, "status")) {
      throw createError({
        statusCode: 403,
        statusMessage: "Use the issue workflow action to change status",
      });
    }
    return validate(updateSchema, body);
  });
  const { records } = await mutateRecords(workspace, input, (records, input) => {
    requireReadableIssue(records, persona, id);
    updateIssue(records, id, input, requireWritablePersona(persona));
  });
  return visibleRecords(persona, records);
});
