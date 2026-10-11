import { createError, getCookie, setCookie, type H3Event } from "h3";
import { demoPersonaIds } from "../../shared/types";
import type { DemoPersona, DemoPersonaInfo, Issue, Project } from "../../shared/types";
import { people, projects } from "../../shared/mock-data";
import type { Records } from "./records";
import { findIssue, updateWorkflowStatus } from "./records";

export const personaCookie = "orbit-demo-persona";
export const defaultPersona: DemoPersona = "employee";
export const demoPersonas: DemoPersonaInfo[] = [
  {
    id: "employee",
    name: "Alex Morgan",
    initials: "AM",
    role: "Employee",
    description: "Can view and update issues, comment, and request review.",
    userId: "alex",
  },
  {
    id: "manager",
    name: "Sam Rivera",
    initials: "SR",
    role: "Manager",
    description: "Can do employee actions and approve issues in review.",
    userId: "sam",
  },
  {
    id: "guest",
    name: "Guest Viewer",
    initials: "GV",
    role: "Guest",
    description: "Read-only access to shared projects; Design System is restricted.",
    userId: null,
  },
];

const personaSet = new Set<string>(demoPersonaIds);
const restrictedProjects = new Set(["design"]);
const isPersona = (value: string | undefined): value is DemoPersona =>
  !!value && personaSet.has(value);

/** This cookie selects a demo persona, not an authenticated identity. */
export function getDemoPersona(event: H3Event): DemoPersona {
  const value = getCookie(event, personaCookie);
  return isPersona(value) ? value : defaultPersona;
}

export function setDemoPersona(event: H3Event, persona: DemoPersona) {
  setCookie(event, personaCookie, persona, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function canReadProject(persona: DemoPersona, projectId: string) {
  return persona !== "guest" || !restrictedProjects.has(projectId);
}

export function canReadIssue(persona: DemoPersona, issue: Issue) {
  return !issue.project || canReadProject(persona, issue.project);
}

export function visibleProjects(persona: DemoPersona): Project[] {
  return projects.filter((project) => canReadProject(persona, project.id));
}

export function visibleRecords(persona: DemoPersona, records: Records): Records {
  const projectIds = new Set(visibleProjects(persona).map((project) => project.id));
  const issues = records.issues.filter((issue) => !issue.project || projectIds.has(issue.project));
  const issueIds = new Set(issues.map((issue) => issue.id));
  return {
    issues,
    activities: records.activities.filter((activity) => issueIds.has(activity.issueId)),
  };
}

export function visibleProjectRecords(persona: DemoPersona, records: Records) {
  const visible = visibleRecords(persona, records);
  return {
    projects: visibleProjects(persona).map((project) => ({
      ...project,
      issueCount: visible.issues.filter((issue) => issue.project === project.id).length,
    })),
    people,
  };
}

export function requireReadableIssue(records: Records, persona: DemoPersona, id: string) {
  const issue = findIssue(records, id);
  if (!canReadIssue(persona, issue)) {
    throw createError({ statusCode: 404, statusMessage: "Issue not found" });
  }
  return issue;
}

export function requireWritablePersona(persona: DemoPersona) {
  const userId = personaInfo(persona).userId;
  if (userId === null) {
    throw createError({ statusCode: 403, statusMessage: "This demo persona is read-only" });
  }
  return userId;
}

export type WorkflowAction = "start-work" | "request-review" | "approve";

const workflow: Record<
  WorkflowAction,
  {
    from: Issue["status"][];
    to: Issue["status"];
    personas: DemoPersona[];
    forbiddenMessage?: string;
  }
> = {
  "start-work": {
    from: ["Backlog", "Todo"],
    to: "In progress",
    personas: ["employee", "manager"],
  },
  "request-review": {
    from: ["In progress"],
    to: "In review",
    personas: ["employee", "manager"],
  },
  approve: {
    from: ["In review"],
    to: "Done",
    personas: ["manager"],
    forbiddenMessage: "Only a manager can approve issues",
  },
};

export function availableWorkflowAction(persona: DemoPersona, status: Issue["status"]) {
  return (
    (Object.keys(workflow) as WorkflowAction[]).find(
      (action) =>
        workflow[action].personas.includes(persona) && workflow[action].from.includes(status),
    ) ?? null
  );
}

export function performWorkflowAction(
  records: Records,
  persona: DemoPersona,
  id: string,
  action: WorkflowAction,
) {
  const issue = requireReadableIssue(records, persona, id);
  const actor = requireWritablePersona(persona);

  const transition = workflow[action];
  if (!transition.personas.includes(persona)) {
    throw createError({
      statusCode: 403,
      statusMessage:
        transition.forbiddenMessage ?? "This persona cannot perform that workflow action",
    });
  }
  if (!transition.from.includes(issue.status)) {
    throw createError({
      statusCode: 409,
      statusMessage: "That workflow action is not available for this issue",
    });
  }
  updateWorkflowStatus(records, id, transition.to, actor);
  return issue;
}

export function personaInfo(persona: DemoPersona) {
  return demoPersonas.find((entry) => entry.id === persona)!;
}
