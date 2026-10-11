import { test, expect } from "@playwright/test";
import type { Spec } from "@json-render/core";

test("Inspect applies client-only JSON without reloading and preserves actions", async ({
  page,
  request,
}) => {
  const failures: string[] = [];
  const writes: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("request", (req) => {
    if (req.method() !== "GET") writes.push(req.url());
  });
  await page.goto("/?view=issues");
  await expect(page.locator(".jr-issue-row")).toHaveCount(22);
  const original: Spec = await (await request.get("/api/views/all-issues")).json();
  let documents = 0;
  page.on("request", (req) => {
    if (req.isNavigationRequest() && req.frame() === page.mainFrame()) documents++;
  });
  await page.getByRole("button", { name: "Inspect UI", exact: true }).click();
  const inspector = page.getByRole("complementary", { name: "Inspect UI", exact: true });
  const editor = inspector.getByRole("textbox", { name: "UI Spec JSON" });
  await expect(editor).toHaveValue(JSON.stringify(original, null, 2));
  const changed = structuredClone(original);
  changed.elements.heading!.props.title = "Client preview";
  changed.elements.page!.children = changed.elements.page!.children!.filter((id) => id !== "tabs");
  await editor.fill(JSON.stringify(changed, null, 2));
  await expect(page.getByRole("heading", { name: "All issues", exact: true })).toBeVisible();
  await inspector.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Client preview", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Issue scope", exact: true })).toHaveCount(0);
  await expect(inspector.getByRole("status")).toContainText("Server spec unchanged");
  await inspector.getByRole("button", { name: "Close Inspect UI" }).click();
  await expect(page.getByRole("button", { name: "Inspect UI", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "New issue", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "New issue", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("button", { name: "Projects", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("button", { name: "All issues", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Client preview", exact: true })).toBeVisible();
  expect(documents).toBe(0);
  expect(await (await request.get("/api/views/all-issues")).json()).toEqual(original);
  expect(writes).toEqual([]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "All issues", exact: true })).toBeVisible();
  expect(failures).toEqual([]);
});

test("invalid edits leave Renderer intact and restoring clears drafts and overrides", async ({
  page,
}) => {
  await page.goto("/?view=issues");
  await page.getByRole("button", { name: "Inspect UI", exact: true }).click();
  const inspector = page.getByRole("complementary", { name: "Inspect UI", exact: true });
  const editor = inspector.getByRole("textbox", { name: "UI Spec JSON" });
  await expect(editor).not.toHaveValue("");
  const original = await editor.inputValue();
  await editor.fill("{");
  await inspector.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(inspector.getByRole("alert")).toBeVisible();
  await expect(page.locator(".jr-issue-row")).toHaveCount(22);
  await inspector.getByRole("button", { name: "Restore server spec" }).click();
  await expect(editor).toHaveValue(original);
  await expect(inspector.getByRole("alert")).toHaveCount(0);
  const invalid: Spec = JSON.parse(original);
  invalid.elements.page!.children!.push("missing-child");
  await editor.fill(JSON.stringify(invalid));
  await inspector.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(inspector.getByRole("alert")).toBeVisible();
  const invalidAction: Spec = JSON.parse(original);
  invalidAction.elements.create!.on = { press: { action: "unknownAction" } };
  await editor.fill(JSON.stringify(invalidAction));
  await inspector.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(inspector.getByRole("alert")).toContainText("Unknown view action");
  const valid: Spec = JSON.parse(original);
  valid.elements.heading!.props.title = "Temporary layout";
  await editor.fill(JSON.stringify(valid));
  await editor.press("Control+Enter");
  await expect(page.getByRole("heading", { name: "Temporary layout", exact: true })).toBeVisible();
  await inspector.getByRole("button", { name: "Restore server spec" }).click();
  await expect(page.getByRole("heading", { name: "All issues", exact: true })).toBeVisible();
  await expect(editor).toHaveValue(original);
  await expect(page.locator(".jr-issue-row")).toHaveCount(22);
});

test("Inspect follows all four views and works at 320px", async ({ page }) => {
  await page.goto("/?view=my-issues");
  await page.getByRole("button", { name: "Inspect UI", exact: true }).click();
  const inspector = page.getByRole("complementary", { name: "Inspect UI", exact: true });
  const editor = inspector.getByRole("textbox", { name: "UI Spec JSON" });
  await expect(inspector).toContainText("my-issues");
  await expect(editor).toHaveValue(/My issues/);
  await page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("button", { name: "Projects", exact: true })
    .click();
  await expect(inspector).toContainText("projects");
  await expect(editor).toHaveValue(/ProjectCard/);
  await page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("button", { name: "All issues", exact: true })
    .click();
  await expect(editor).toHaveValue(/All issues/);
  await page
    .getByRole("button", { name: "ENG-101: Fix session expiry during workspace switching" })
    .click();
  await expect(inspector).toContainText("issue-detail");
  await expect(editor).toHaveValue(/PropertyField/);
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await editor.fill("{");
  await inspector.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(inspector.getByRole("alert")).toBeVisible();
  await inspector.getByRole("button", { name: "Restore server spec" }).click();
  await inspector.getByRole("button", { name: "Close Inspect UI" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Fix session expiry during workspace switching",
      exact: true,
    }),
  ).toBeVisible();
});
