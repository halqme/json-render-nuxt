export const statuses = ["Backlog", "Todo", "In progress", "In review", "Done"] as const;
export const priorities = ["Urgent", "High", "Medium", "Low"] as const;

export type IssueStatus = (typeof statuses)[number];
export type IssuePriority = (typeof priorities)[number];

export const demoPersonaIds = ["employee", "manager", "guest"] as const;
export type DemoPersona = (typeof demoPersonaIds)[number];

export interface DemoPersonaInfo {
  id: DemoPersona;
  name: string;
  initials: string;
  role: string;
  description: string;
  userId: string | null;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  /** Person ID; empty string means unassigned. */
  assignee: string;
  /** Project ID; empty string means no project. */
  project: string;
  labels: string[];
  createdAt: string;
}

export interface Person {
  id: string;
  name: string;
  initials: string;
  color: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  team: string;
  lead: string;
  progress: number;
  targetDate: string;
  color: string;
  icon: string;
}

export interface Activity {
  id: string;
  issueId: string;
  author: string;
  text: string;
  createdAt: string;
  type: "comment" | "change";
}

export type CreateIssueInput = Pick<Issue, "title"> &
  Partial<Omit<Issue, "id" | "title" | "createdAt" | "status">>;

export interface IssueGroup {
  status: IssueStatus;
  count: number;
  issues: Issue[];
}

export type WorkspaceId = "orbit" | "sandbox";

export interface TrackerState extends Record<string, unknown> {
  persona: DemoPersona;
  personaUserId: string | null;
  personaName: string;
  personaInitials: string;
  personaRole: string;
  personas: DemoPersonaInfo[];
  workspaceId: WorkspaceId;
  workspaceName: string;
  view: string;
  query: string;
  statusFilter: string;
  priorityFilter: string;
  assigneeFilter: string;
  projectFilter: string;
  tab: "all" | "active" | "done";
  groups: IssueGroup[];
  allIssues: Issue[];
  filteredCount: number;
  totalCount: number;
  projects: (Project & { issueCount: number })[];
  people: Person[];
  selectedIssue: Issue | null;
  activities: Activity[];
  draftComment: string;
  notice: string;
  selectedIds: string[];
}
