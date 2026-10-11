import { test, expect } from "./fixtures";
import type { Spec } from "@json-render/core";

test("Inspect edits the full issue-detail Spec in memory without server writes", async ({
  page,
  request,
}) => {
  const failures: string[] = [];
  const writes: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("request", (req) => {
    if (req.method() !== "GET") writes.push(req.url());
  });
  await page.goto("/?view=issues&issue=ENG-101");
  await expect(page.getByRole("button", { name: "Request review", exact: true })).toBeVisible();
  const original: Spec = await (
    await request.get("/api/views/issue-detail?workspace=orbit&issue=ENG-101")
  ).json();
  let documents = 0;
  page.on("request", (req) => {
    if (req.isNavigationRequest() && req.frame() === page.mainFrame()) documents++;
  });

  await page.getByRole("button", { name: "Inspect UI", exact: true }).click();
  const inspector = page.getByRole("complementary", { name: "Inspect UI", exact: true });
  const editor = inspector.getByRole("textbox", { name: "UI Spec JSON" });
  await expect(editor).toHaveValue(JSON.stringify(original, null, 2));
  const changed = structuredClone(original);
  changed.elements["workflow-message"]!.props.text = "Client preview only.";
  await editor.fill(JSON.stringify(changed, null, 2));
  await inspector.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByText("Client preview only.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Request review", exact: true })).toBeVisible();
  await expect(inspector.getByRole("status")).toContainText("Server spec unchanged");
  await inspector.getByRole("button", { name: "Close Inspect UI" }).click();
  await expect(page.getByRole("button", { name: "Inspect UI", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Back to issues", exact: true }).click();
  await expect(page.getByRole("heading", { name: "All issues", exact: true })).toBeVisible();
  expect(documents).toBe(0);
  expect(
    await (await request.get("/api/views/issue-detail?workspace=orbit&issue=ENG-101")).json(),
  ).toEqual(original);
  expect(writes).toEqual([]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "All issues", exact: true })).toBeVisible();
  expect(failures).toEqual([]);
});

test("invalid detail edits leave the server Spec intact and Restore clears drafts", async ({
  page,
}) => {
  await page.goto("/?issue=ENG-101");
  await page.getByRole("button", { name: "Inspect UI", exact: true }).click();
  const inspector = page.getByRole("complementary", { name: "Inspect UI", exact: true });
  const editor = inspector.getByRole("textbox", { name: "UI Spec JSON" });
  const original = await editor.inputValue();

  await editor.fill("{");
  await inspector.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(inspector.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Request review", exact: true })).toBeVisible();
  await inspector.getByRole("button", { name: "Restore server spec" }).click();
  await expect(editor).toHaveValue(original);
  await expect(inspector.getByRole("alert")).toHaveCount(0);

  const invalid: Spec = JSON.parse(original);
  invalid.elements["workflow-status"]!.type = "UnknownCatalogComponent";
  await editor.fill(JSON.stringify(invalid));
  await inspector.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(inspector.getByRole("alert")).toBeVisible();

  const invalidAction: Spec = JSON.parse(original);
  invalidAction.elements["workflow-advance"]!.on = {
    advance: { action: "otherAction", params: {} },
  };
  await editor.fill(JSON.stringify(invalidAction));
  await inspector.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(inspector.getByRole("alert")).toBeVisible();

  const valid: Spec = JSON.parse(original);
  valid.elements["workflow-message"]!.props.text = "Temporary detail message.";
  await editor.fill(JSON.stringify(valid));
  await editor.press("Control+Enter");
  await expect(page.getByText("Temporary detail message.", { exact: true })).toBeVisible();
  await inspector.getByRole("button", { name: "Restore server spec" }).click();
  await expect(page.getByRole("button", { name: "Request review", exact: true })).toBeVisible();
  await expect(editor).toHaveValue(original);
});

test("Inspect is available only for issue detail and works at 320px", async ({ page }) => {
  await page.goto("/?view=my-issues");
  await expect(page.getByRole("button", { name: "Inspect UI", exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "ENG-101: Fix session expiry during workspace switching" })
    .click();
  await page.getByRole("button", { name: "Inspect UI", exact: true }).click();
  const inspector = page.getByRole("complementary", { name: "Inspect UI", exact: true });
  const editor = inspector.getByRole("textbox", { name: "UI Spec JSON" });
  await expect(inspector).toContainText("issue detail");
  await expect(editor).toHaveValue(/WorkflowPanel/);
  await expect(editor).not.toHaveValue(/IssueRow|ProjectCard/);
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
