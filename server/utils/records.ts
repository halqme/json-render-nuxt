import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createError } from "h3";
import { initialIssues, initialActivities, people, projects } from "../../shared/mock-data";
import { statuses, priorities } from "../../shared/types";
import type { Issue, Activity } from "../../shared/types";

const properties = z
  .object({
    title: z.string().trim().min(1).max(500),
    description: z.string().max(50000),
    status: z.enum(statuses),
    priority: z.enum(priorities),
    assignee: z.string().refine((id) => id === "" || people.some((p) => p.id === id)),
    project: z.string().refine((id) => id === "" || projects.some((p) => p.id === id)),
    labels: z.array(z.string().trim().min(1).max(100)).max(50),
  })
  .strict();
export const createSchema = properties.omit({ status: true }).partial().required({ title: true });
// Status changes are made only through the workflow endpoint, never a field patch.
export const updateSchema = properties
  .omit({ status: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0);
export const commentSchema = z.object({ text: z.string().trim().min(1).max(10000) }).strict();
export const workspaceSchema = z.enum(["orbit", "sandbox"]);
export const workflowSchema = z
  .object({ action: z.enum(["start-work", "request-review", "approve"]) })
  .strict();
const issueId = z
  .string()
  .regex(/^ENG-[1-9][0-9]*$/)
  .refine((id) => Number.isSafeInteger(Number(id.slice(4))));
const timestamp = z.iso.datetime();
const recordsSchema = z
  .object({
    issues: z.array(properties.extend({ id: issueId, createdAt: timestamp })),
    activities: z.array(
      z
        .object({
          id: z.string().min(1),
          issueId,
          author: z.string().refine((id) => people.some((person) => person.id === id)),
          text: z.string(),
          type: z.enum(["comment", "change"]),
          createdAt: timestamp,
        })
        .strict(),
    ),
  })
  .strict()
  .refine((records) => {
    const issues = new Set(records.issues.map((issue) => issue.id));
    const activities = new Set(records.activities.map((activity) => activity.id));
    return (
      issues.size === records.issues.length &&
      activities.size === records.activities.length &&
      records.activities.every((activity) => issues.has(activity.issueId))
    );
  }, "Invalid persisted identity graph");
export type Records = { issues: Issue[]; activities: Activity[] };

export function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw createError({ statusCode: 400, statusMessage: "Invalid request" });
  return result.data;
}

// Synchronous read-modify-rename keeps mutations serialized in this single-process local app.
// Read on every request: a failed write never changes the authoritative in-memory view.
export function recordFile(workspace: string) {
  return resolve(process.env.ORBIT_DATA_DIR || ".data", `${workspace}.json`);
}
export function saveRecords(workspace: string, records: Records) {
  const file = recordFile(workspace);
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, JSON.stringify(records), { mode: 0o600 });
  renameSync(temporary, file);
}
export function loadRecords(workspace: string): Records {
  const file = recordFile(workspace);
  try {
    return recordsSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const records = structuredClone({ issues: initialIssues, activities: initialActivities });
    saveRecords(workspace, records);
    return records;
  }
}

/** Await input parsing before entering the synchronous authoritative read-modify-save transaction. */
export async function mutateRecords<T, R>(
  workspace: string,
  input: Promise<T>,
  mutate: (records: Records, input: T) => R & (R extends PromiseLike<unknown> ? never : unknown),
) {
  const value = await input;
  const records = loadRecords(workspace);
  const result = mutate(records, value);
  saveRecords(workspace, records);
  return { records, result };
}

function history(
  records: Records,
  issueId: string,
  text: string,
  type: Activity["type"],
  author = "alex",
) {
  records.activities.push({
    id: randomUUID(),
    issueId,
    text,
    type,
    author,
    createdAt: new Date().toISOString(),
  });
}
export function createIssue(
  records: Records,
  input: z.infer<typeof createSchema>,
  author = "alex",
) {
  const number =
    records.issues.reduce((maximum, issue) => Math.max(maximum, Number(issue.id.slice(4))), 100) +
    1;
  if (!Number.isSafeInteger(number)) {
    throw createError({ statusCode: 500, statusMessage: "Issue identifiers exhausted" });
  }
  const issue: Issue = {
    description: "",
    status: "Todo",
    priority: "Medium",
    assignee: "alex",
    project: "",
    labels: [],
    ...input,
    id: `ENG-${number}`,
    createdAt: new Date().toISOString(),
  };
  records.issues.unshift(issue);
  history(records, issue.id, "Created this issue.", "change", author);
  return issue;
}
export function findIssue(records: Records, id: string) {
  const issue = records.issues.find((record) => record.id === id);
  if (!issue) throw createError({ statusCode: 404, statusMessage: "Issue not found" });
  return issue;
}
export function updateIssue(
  records: Records,
  id: string,
  input: z.infer<typeof updateSchema>,
  author = "alex",
) {
  const issue = findIssue(records, id);
  for (const key of Object.keys(input) as (keyof typeof input)[]) {
    const value = input[key];
    if (JSON.stringify(issue[key]) === JSON.stringify(value)) continue;
    const display = (entry: unknown) => {
      if (key === "assignee") return people.find((p) => p.id === entry)?.name ?? "Unassigned";
      if (key === "project") return projects.find((p) => p.id === entry)?.name ?? "No project";
      return Array.isArray(entry)
        ? entry.join(", ") || "none"
        : typeof entry === "string"
          ? entry || "empty"
          : "empty";
    };
    history(
      records,
      id,
      `Changed ${key} from ${display(issue[key])} to ${display(value)}.`,
      "change",
      author,
    );
  }
  Object.assign(issue, input);
}

export function updateWorkflowStatus(
  records: Records,
  id: string,
  status: Issue["status"],
  author: string,
) {
  const issue = findIssue(records, id);
  if (issue.status === status) return;
  history(records, id, `Changed status from ${issue.status} to ${status}.`, "change", author);
  issue.status = status;
}

export function addComment(records: Records, id: string, text: string, author = "alex") {
  findIssue(records, id);
  history(records, id, text, "comment", author);
}
