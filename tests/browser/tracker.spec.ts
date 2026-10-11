import { test, expect } from "./fixtures";

test("Vue tracker shell, issue details and persona-authorized workflow", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "All issues", exact: true })).toBeVisible();
  await expect(page.locator(".jr-issue-row")).toHaveCount(22);
  await page.screenshot({ path: "test-results/all-issues.png", fullPage: true });
  await page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("button", { name: "My issues", exact: true })
    .click();
  await expect(page.locator(".jr-issue-row")).toHaveCount(7);
  await page.getByRole("textbox", { name: "Search issues", exact: true }).fill("session");
  await expect(page.locator(".jr-issue-row")).toHaveCount(1);
  await page
    .getByRole("button", { name: "ENG-101: Fix session expiry during workspace switching" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Fix session expiry during workspace switching",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Request review", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Request review", exact: true }).click();
  await expect(
    page.locator(".jr-section-properties").getByText("In review", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("A manager must approve it.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve issue", exact: true })).toHaveCount(0);
  await expect(
    page.getByText("Changed status from In progress to In review.", { exact: true }),
  ).toBeVisible();

  await page.getByRole("combobox", { name: "Change priority", exact: true }).click();
  await page.getByRole("option", { name: "High", exact: true }).click();
  await expect(
    page.getByText("Changed priority from Urgent to High.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Comment", exact: true })
    .fill("Session guard verified in staging. Ready to ship.");
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  await expect(
    page.getByText("Session guard verified in staging. Ready to ship.", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Alex Morgan demo persona menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Manager · Sam Rivera", exact: true }).click();
  await expect(page.getByRole("button", { name: "Approve issue", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Approve issue", exact: true }).click();
  await expect(
    page.locator(".jr-section-properties").getByText("Done", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve issue", exact: true })).toHaveCount(0);
  await page.screenshot({ path: "test-results/issue-detail.png", fullPage: true });
  await page.reload();
  await expect(
    page.locator(".jr-section-properties").getByText("Done", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Session guard verified in staging. Ready to ship.", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Back to issues", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My issues", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator(".jr-issue-row")).toHaveCount(4);
  await page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("button", { name: "All issues", exact: true })
    .click();
  await page.getByRole("combobox", { name: "Status", exact: true }).click();
  await page.getByRole("option", { name: "In progress", exact: true }).click();
  await expect(page.locator(".jr-issue-row")).toHaveCount(3);
  await page.getByRole("combobox", { name: "Priority", exact: true }).click();
  await page.getByRole("option", { name: "High", exact: true }).click();
  await expect(page.locator(".jr-issue-row")).toHaveCount(3);
  await page.getByRole("combobox", { name: "Assignee", exact: true }).click();
  await page.getByRole("option", { name: "Alex Morgan", exact: true }).click();
  await expect(page.locator(".jr-issue-row")).toHaveCount(1);
  await page.getByRole("checkbox", { name: "Select ENG-112", exact: true }).check();
  await expect(page.locator(".jr-list-summary")).toContainText("1 selected");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.getByRole("button", { name: "New issue", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New issue", exact: true });
  await dialog
    .getByRole("textbox", { name: "Issue title (required)", exact: true })
    .fill("Add a trace ID to webhook delivery logs");
  await dialog
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Correlate retries with the originating request.");
  await dialog.getByRole("button", { name: "Create issue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Add a trace ID to webhook delivery logs", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to issues", exact: true }).click();
  await expect(page.locator(".jr-issue-row")).toHaveCount(23);
  await page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("button", { name: "Projects", exact: true })
    .click();
  await expect(page.locator(".jr-project-card")).toHaveCount(4);
  await page.screenshot({ path: "test-results/projects.png", fullPage: true });
  await page.getByRole("button", { name: "Open Platform reliability issues", exact: true }).click();
  await expect(page.locator(".jr-issue-row")).toHaveCount(6);
  await expect(page).toHaveURL(/project=platform/);
  expect(errors).toEqual([]);
});

test("guest persona filters restricted data and clears inaccessible issue routes", async ({
  page,
}) => {
  await page.goto("/?view=issues&issue=ENG-117");
  await expect(
    page.getByRole("heading", {
      name: "Standardize focus rings across form controls",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Alex Morgan demo persona menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Guest · Guest Viewer", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Guest Viewer demo persona menu", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Standardize focus rings across form controls",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(page).not.toHaveURL(/issue=ENG-117/);

  const records = await page.evaluate(async () =>
    fetch("/api/workspaces/orbit/records").then((response) => response.json()),
  );
  expect(records.issues).toHaveLength(17);
  expect(records.issues.some((issue: { project: string }) => issue.project === "design")).toBe(
    false,
  );
  const projects = await page.evaluate(async () =>
    fetch("/api/workspaces/orbit/projects").then((response) => response.json()),
  );
  expect(projects.projects).toHaveLength(3);
  expect(projects.projects.some((project: { id: string }) => project.id === "design")).toBe(false);

  await page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("button", { name: "Projects" })
    .click();
  await expect(page.locator(".jr-project-card")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "Design system", exact: true })).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("button", { name: "All issues" })
    .click();
  await expect(page.locator(".jr-issue-row")).toHaveCount(17);
  await page.getByRole("button", { name: "Search workspace (Command or Control K)" }).click();
  await page
    .getByRole("combobox", { name: "Search issues and navigation" })
    .fill("Standardize focus rings");
  await expect(page.getByRole("option", { name: /Standardize focus rings/ })).toHaveCount(0);

  const deniedDetail = await page.evaluate(async () =>
    fetch("/api/views/issue-detail?workspace=orbit&issue=ENG-117").then(
      (response) => response.status,
    ),
  );
  expect(deniedDetail).toBe(404);
  await page.goto("/?view=issues&project=design&issue=ENG-117");
  await expect(page.getByText(/unavailable for this demo persona/)).toBeVisible();
  await expect(page.locator(".jr-issue-row")).toHaveCount(17);
  await page
    .getByRole("button", { name: "ENG-101: Fix session expiry during workspace switching" })
    .click();
  await expect(
    page.getByRole("region", { name: "Issue workflow" }).getByText("Guest access is read-only."),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Comment", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Request review", exact: true })).toHaveCount(0);
});

test("My issues follows the current persona user identity", async ({ page }) => {
  await page.goto("/?view=my-issues");
  await expect(page.locator('.jr-issue-row[data-issue-id="ENG-101"]')).toBeVisible();
  await expect(page.locator('.jr-issue-row[data-issue-id="ENG-102"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Alex Morgan demo persona menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Manager · Sam Rivera", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sam Rivera demo persona menu", exact: true }),
  ).toBeVisible();
  await expect(page.locator('.jr-issue-row[data-issue-id="ENG-102"]')).toBeVisible();
  await expect(page.locator('.jr-issue-row[data-issue-id="ENG-101"]')).toHaveCount(0);
});

test("empty state, global command palette and browser back", async ({ page }) => {
  await page.goto("/?view=my-issues");
  await page
    .getByRole("textbox", { name: "Search issues", exact: true })
    .fill("not-an-existing-issue");
  await expect(page.getByRole("heading", { name: "No issues found", exact: true })).toBeVisible();
  await page.keyboard.press("Meta+k");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("combobox", { name: "Search issues and navigation" })
    .fill("connection pooling");
  await expect(
    dialog.getByRole("option", { name: /Add connection pooling to the events worker/ }),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Add connection pooling to the events worker", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "My issues", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await expect(page.locator(".jr-issue-row")).toHaveCount(7);
});

test("issue filters and assignee labels are keyboard-accessible", async ({ page }) => {
  await page.goto("/?view=issues");
  await expect(page.getByRole("search", { name: "Filter issues" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Assignee: Unassigned", exact: true }).first(),
  ).toBeVisible();

  const row = page.locator('.jr-issue-row[data-issue-id="ENG-101"]');
  const assignee = row.getByRole("button", { name: "Assignee: Alex Morgan", exact: true });
  await row
    .getByRole("button", {
      name: "ENG-101: Fix session expiry during workspace switching",
      exact: true,
    })
    .focus();
  await page.keyboard.press("Tab");
  await expect(assignee).toBeFocused();
  await expect(assignee).toHaveAttribute("aria-describedby", /^reka-tooltip/);
  await expect(page.locator('[role="tooltip"]').last()).toBeVisible();

  await page.getByRole("textbox", { name: "Search issues", exact: true }).fill("not-an-issue");
  await expect(page.getByRole("status").filter({ hasText: "No issues found" })).toBeVisible();
});

test("320px responsive views and modal", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await expect(page.locator(".jr-issue-row")).toHaveCount(22);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  await page.getByRole("button", { name: "New issue", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create issue", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "ENG-101: Fix session expiry during workspace switching" })
    .click();
  await expect(page.getByRole("combobox", { name: "Change priority", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("issue detail fetch failure has a recoverable error state", async ({ page }) => {
  await page.route("**/api/views/issue-detail**", (route) =>
    route.fulfill({ status: 500, body: "{}" }),
  );
  await page.goto("/?issue=ENG-101");
  await expect(
    page.getByText("The issue detail view could not be loaded.", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/views/issue-detail**");
  await page.getByRole("button", { name: "Retry view", exact: true }).click();
  await expect(page.getByRole("button", { name: "Request review", exact: true })).toBeVisible();
});

test("an older same-key issue detail response cannot replace the latest A-B-A selection", async ({
  page,
}) => {
  let releaseFirstResponse!: () => void;
  const firstResponseGate = new Promise<void>((resolve) => {
    releaseFirstResponse = resolve;
  });
  let markFirstRequestSeen!: () => void;
  const firstRequestSeen = new Promise<void>((resolve) => {
    markFirstRequestSeen = resolve;
  });
  let markFirstRequestFinished!: () => void;
  const firstRequestFinished = new Promise<void>((resolve) => {
    markFirstRequestFinished = resolve;
  });
  let delayFirstIssueRequest = true;

  await page.route("**/api/views/issue-detail**", async (route) => {
    const issue = new URL(route.request().url()).searchParams.get("issue");
    if (issue !== "ENG-101") {
      await route.continue();
      return;
    }

    if (delayFirstIssueRequest) {
      delayFirstIssueRequest = false;
      markFirstRequestSeen();
      await firstResponseGate;
      const response = await route.fetch();
      const spec = await response.json();
      spec.elements["workflow-message"].props.text = "Delayed stale detail response.";
      await route.fulfill({ response, json: spec });
      markFirstRequestFinished();
      return;
    }

    const response = await route.fetch();
    const spec = await response.json();
    spec.elements["workflow-message"].props.text = "Latest detail response.";
    await route.fulfill({ response, json: spec });
  });

  await page.goto("/?issue=ENG-101");
  await firstRequestSeen;
  await page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("button", { name: "All issues", exact: true })
    .click();
  await page
    .getByRole("button", { name: "ENG-102: Add connection pooling to the events worker" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Add connection pooling to the events worker", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to issues", exact: true }).click();
  await page
    .getByRole("button", { name: "ENG-101: Fix session expiry during workspace switching" })
    .click();
  await expect(page.getByText("Latest detail response.", { exact: true })).toBeVisible();

  releaseFirstResponse();
  await firstRequestFinished;
  await expect(page.getByText("Latest detail response.", { exact: true })).toBeVisible();
  await expect(page.getByText("Delayed stale detail response.", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("The issue detail view could not be loaded.", { exact: true }),
  ).toHaveCount(0);
});

test("an older list view response cannot replace the newly selected projects view", async ({
  page,
}) => {
  let releaseFirstResponse!: () => void;
  const firstResponseGate = new Promise<void>((resolve) => {
    releaseFirstResponse = resolve;
  });
  let markFirstRequestSeen!: () => void;
  const firstRequestSeen = new Promise<void>((resolve) => {
    markFirstRequestSeen = resolve;
  });
  let markFirstRequestFinished!: () => void;
  const firstRequestFinished = new Promise<void>((resolve) => {
    markFirstRequestFinished = resolve;
  });

  await page.route("**/api/views/issues**", async (route) => {
    markFirstRequestSeen();
    await firstResponseGate;
    const response = await route.fetch();
    const spec = await response.json();
    spec.elements.header.props.view = "my-issues";
    await route.fulfill({ response, json: spec });
    markFirstRequestFinished();
  });

  await page.goto("/?view=issues");
  await firstRequestSeen;
  await page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("button", { name: "Projects", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();

  releaseFirstResponse();
  await firstRequestFinished;
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "My issues", exact: true })).toHaveCount(0);
});
