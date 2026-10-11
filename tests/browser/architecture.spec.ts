import { test, expect } from "./fixtures";
import { initialIssues } from "../../shared/mock-data";
import {
  getIssueDetailSpec,
  getIssueListSpec,
  getProjectsSpec,
} from "../../server/utils/view-specs";
import { validateViewSpec } from "../../shared/validate-view";

test("server view Specs compose list, project, detail and workflow sections with bindings and repeats", async ({
  request,
}) => {
  const review = initialIssues.find((issue) => issue.id === "ENG-102")!;
  const employee = getIssueDetailSpec("employee", review);
  const manager = getIssueDetailSpec("manager", review);
  const guest = getIssueDetailSpec("guest", review);
  expect(employee.elements.workflow!.children).toEqual(["workflow-status", "workflow-message"]);
  expect(manager.elements.workflow!.children).toEqual([
    "workflow-status",
    "workflow-message",
    "workflow-advance",
  ]);
  expect(manager.elements["workflow-advance"]!.props.action).toBe("approve");
  expect(manager.elements["workflow-advance"]!.on).toEqual({
    advance: { action: "workflowAction", params: { action: "approve" } },
  });
  expect(guest.elements.workflow!.children).toEqual(["workflow-message", "workflow-status"]);
  expect(employee.elements.detail!.children).toEqual(["back", "heading", "columns"]);
  expect(employee.elements.columns!.children).toEqual([
    "description",
    "activity",
    "comment",
    "readOnly",
  ]);
  expect(employee.elements.comment!.visible).toEqual({ $state: "/persona", neq: "guest" });
  expect(guest.elements.comment!.visible).toEqual({ $state: "/persona", neq: "guest" });
  expect(employee.elements["priority-edit"]!.on).toEqual({
    change: {
      action: "changeProperty",
      params: { field: "priority", value: { $state: "/selectedIssue/priority" } },
    },
  });
  expect(employee.elements["priority-edit"]!.props).not.toHaveProperty("statePath");
  expect(employee.elements["assignee-edit"]!.props).not.toHaveProperty("statePath");
  expect(employee.elements["project-edit"]!.props).not.toHaveProperty("statePath");
  expect(employee.elements.activity!.children).toEqual(["activity-rows", "activity-empty"]);
  expect(employee.elements["activity-rows"]!.repeat).toEqual({
    statePath: "/activities",
    key: "id",
  });
  expect(employee.elements["activity-item"]!.props.activity).toEqual({ $item: "" });
  expect(employee.elements["activity-empty"]!.visible).toEqual({
    $state: "/activities.length",
    eq: 0,
  });
  expect(validateViewSpec(employee)).toEqual(employee);

  const issues = getIssueListSpec("issues");
  const mine = getIssueListSpec("my-issues");
  const projects = getProjectsSpec();
  expect(issues.elements.page!.children).toEqual([
    "header",
    "filters",
    "summary",
    "groups",
    "empty",
  ]);
  expect(mine.elements.header!.props.view).toBe("my-issues");
  expect(issues.elements.filters!.props.query).toEqual({ $bindState: "/query" });
  expect(issues.elements.groups!.repeat).toEqual({ statePath: "/groups", key: "status" });
  expect(issues.elements.rows!.repeat).toEqual({ statePath: { $item: "issues" }, key: "id" });
  expect(issues.elements.row!.on).toEqual({
    open: { action: "openIssue", params: { issueId: { $item: "id" } } },
    toggle: { action: "toggleIssueSelection", params: { issueId: { $item: "id" } } },
  });
  expect(issues.elements["new-issue"]!.visible).toEqual({ $state: "/persona", neq: "guest" });
  expect(projects.elements.grid!.repeat).toEqual({ statePath: "/projects", key: "id" });
  expect(projects.elements["project-card"]!.on).toEqual({
    open: { action: "openProject", params: { projectId: { $item: "id" } } },
  });

  const invalid = structuredClone(manager);
  invalid.elements["workflow-status"]!.type = "UnknownCatalogComponent";
  expect(() => validateViewSpec(invalid)).toThrow();
  expect((await request.get("/api/views/all-issues")).status()).toBe(404);
  for (const view of ["issues", "my-issues", "projects"]) {
    const response = await request.get(`/api/views/${view}?workspace=orbit`);
    expect(response.status()).toBe(200);
    expect((await response.json()).root).toBe("page");
  }
  expect(
    (await request.get("/api/views/issue-detail?workspace=orbit&issue=ENG-102")).status(),
  ).toBe(200);
  await request.post("/api/demo/persona", { data: { persona: "manager" } });
  const detail = await (
    await request.get("/api/views/issue-detail?workspace=orbit&issue=ENG-102")
  ).json();
  expect(detail.root).toBe("detail");
  expect(detail.elements.heading.type).toBe("IssueHeading");
  expect(detail.elements["workflow-advance"].props.action).toBe("approve");
});

test("server-authored view Specs control list, project and detail composition", async ({
  page,
}) => {
  await page.route("**/api/views/issues**", (route) => {
    const spec = getIssueListSpec("issues");
    spec.elements.page!.children = spec.elements.page!.children!.filter((key) => key !== "filters");
    return route.fulfill({ json: spec });
  });
  await page.route("**/api/views/projects**", (route) => {
    const spec = getProjectsSpec();
    spec.elements.page!.children = spec.elements.page!.children!.filter((key) => key !== "grid");
    return route.fulfill({ json: spec });
  });
  await page.route("**/api/views/issue-detail**", (route) => {
    const spec = getIssueDetailSpec("employee", initialIssues[0]!);
    spec.elements.columns!.children = ["activity", "description"];
    return route.fulfill({ json: spec });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "All issues", exact: true })).toBeVisible();
  await expect(page.locator(".jr-issue-row")).toHaveCount(22);
  await expect(page.getByRole("textbox", { name: "Search issues", exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "ENG-101: Fix session expiry during workspace switching" })
    .click();
  await expect(page.locator(".jr-section-activity")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Comment", exact: true })).toHaveCount(0);
  const order = await page.evaluate(() => {
    const activity = document.querySelector(".jr-section-activity")!;
    const description = document.querySelector(".jr-section-description")!;
    return !!(activity.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(order).toBe(true);
  await page.getByRole("button", { name: "Back to issues", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("button", { name: "Projects", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await expect(page.locator(".jr-project-card")).toHaveCount(0);
});

test("workspace switching isolates edits and persists the selected workspace", async ({ page }) => {
  await page.goto("/?view=issues&issue=ENG-101");
  await page.getByRole("combobox", { name: "Change priority", exact: true }).click();
  await page.getByRole("option", { name: "Low", exact: true }).click();
  await expect(page.getByText("ENG-101 updated.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Switch workspace", exact: true }).click();
  await page.getByRole("menuitem", { name: "Orbit Sandbox", exact: true }).click();
  await expect(page.getByRole("button", { name: "Switch workspace", exact: true })).toContainText(
    "Orbit Sandbox",
  );
  await expect(page.locator(".jr-issue-row")).toHaveCount(22);
  await expect(page).not.toHaveURL(/issue=/);
  await page
    .getByRole("button", { name: "ENG-101: Fix session expiry during workspace switching" })
    .click();
  await expect(page.getByRole("combobox", { name: "Change priority", exact: true })).toContainText(
    "Urgent",
  );
  await page.reload();
  await expect(page.getByRole("button", { name: "Switch workspace", exact: true })).toContainText(
    "Orbit Sandbox",
  );
  await page.getByRole("button", { name: "Switch workspace", exact: true }).click();
  await page.getByRole("menuitem", { name: "Orbit", exact: true }).click();
  await page
    .getByRole("button", { name: "ENG-101: Fix session expiry during workspace switching" })
    .click();
  await expect(page.getByRole("combobox", { name: "Change priority", exact: true })).toContainText(
    "Low",
  );
});

test("keyboard navigation, project grid at 320px and 200% equivalent viewport", async ({
  page,
}) => {
  await page.goto("/?view=projects");
  await expect(page.locator(".jr-project-card")).toHaveCount(4);
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole("button", { name: "Open Platform reliability issues", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".jr-issue-row")).toHaveCount(6);
  await page.setViewportSize({ width: 720, height: 500 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page
    .getByRole("button", { name: "ENG-101: Fix session expiry during workspace switching" })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("combobox", { name: "Change priority", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.keyboard.press("Meta+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
