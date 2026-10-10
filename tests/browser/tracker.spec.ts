import { test, expect } from "@playwright/test";

test("server-driven views and core issue workflow", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  for (const name of ["my-issues", "all-issues", "projects", "issue-detail"]) {
    const response = await request.get(`/api/views/${name}`);
    expect(response.status()).toBe(200);
    const spec = await response.json();
    expect(Object.keys(spec.elements).length).toBeGreaterThan(5);
    expect(spec.elements[spec.root]).toBeTruthy();
  }
  expect((await request.get("/api/views/unknown")).status()).toBe(404);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "All issues", exact: true })).toBeVisible();
  await expect(page.locator(".jr-issue-row")).toHaveCount(22);
  await page.screenshot({ path: "test-results/all-issues.png", fullPage: true });
  await page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("button", { name: "My issues", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "My issues", exact: true })).toBeVisible();
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
  await page.getByRole("combobox", { name: "Change status", exact: true }).click();
  await page.getByRole("option", { name: "Done", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Change status", exact: true })).toContainText(
    "Done",
  );
  await expect(
    page.getByText("Changed status from In progress to Done.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Change assignee", exact: true }).click();
  await page.getByRole("option", { name: "Maya Chen", exact: true }).click();
  await expect(
    page.getByText("Changed assignee from Alex Morgan to Maya Chen.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Comment", exact: true })
    .fill("Session guard verified in staging. Ready to ship.");
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  await expect(
    page.getByText("Session guard verified in staging. Ready to ship.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/issue-detail.png", fullPage: true });
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Change status", exact: true })).toContainText(
    "Done",
  );
  await expect(
    page.getByText("Session guard verified in staging. Ready to ship.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to issues", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My issues", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator(".jr-issue-row")).toHaveCount(6);
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
  await expect(page.getByRole("combobox", { name: "Change status", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("spec fetch failure has a recoverable error state", async ({ page }) => {
  await page.route("**/api/views/all-issues", (route) =>
    route.fulfill({ status: 500, body: "{}" }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "This view couldn't be loaded", exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/views/all-issues");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator(".jr-issue-row")).toHaveCount(22);
});
