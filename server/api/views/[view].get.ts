import { createError, defineEventHandler, getQuery, getRouterParam, setHeader } from "h3";
import { z } from "zod";
import { getIssueDetailSpec, getIssueListSpec, getProjectsSpec } from "../../utils/view-specs";
import { loadRecords, validate, workspaceSchema } from "../../utils/records";
import { getDemoPersona, requireReadableIssue } from "../../utils/personas";

export default defineEventHandler((event) => {
  const view = getRouterParam(event, "view") ?? "";
  if (!["issue-detail", "issues", "my-issues", "projects"].includes(view)) {
    throw createError({ statusCode: 404, statusMessage: "Unknown view Spec" });
  }
  const query = getQuery(event);
  const workspace = validate(workspaceSchema, query.workspace);
  const persona = getDemoPersona(event);
  setHeader(event, "Cache-Control", "no-store");

  if (view === "issue-detail") {
    const id = validate(z.string().min(1), query.issue);
    const records = loadRecords(workspace);
    return getIssueDetailSpec(persona, requireReadableIssue(records, persona, id));
  }
  if (view === "issues" || view === "my-issues") return getIssueListSpec(view);
  if (view === "projects") return getProjectsSpec();
  throw createError({ statusCode: 404, statusMessage: "Unknown view Spec" });
});
