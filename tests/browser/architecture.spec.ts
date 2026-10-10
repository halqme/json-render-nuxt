import { test, expect } from "@playwright/test";
import { getViewSpec } from "../../server/utils/view-specs";
import { validateViewSpec } from "../../shared/validate-view";

// Guards for the server-driven contract, including events omitted by the Vue schema.
test("spec validation preserves event bindings and nested repeats", () => {
  const spec = getViewSpec("all-issues")!;
  expect(spec.elements.create!.on).toEqual({ press: { action: "newIssue", params: {} } });
  expect(spec.elements.rows!.repeat).toEqual({ statePath: { $item: "issues" }, key: "id" });
  expect(spec.elements.row!.on).toEqual({
    open: { action: "openIssue", params: { idPath: { $item: "id" } } },
    select: { action: "toggleSelection", params: { idPath: { $item: "id" } } },
  });
  expect(getViewSpec("missing")).toBeUndefined();
  const invalid = structuredClone(spec);
  invalid.elements.create!.on = { press: { action: "unknownAction" } };
  expect(() => validateViewSpec(invalid)).toThrow("Unknown view action");
  const broken = structuredClone(spec);
  broken.elements.page!.children!.push("missing-element");
  expect(() => validateViewSpec(broken)).toThrow();
});

test("changing the API spec changes the screen without a page component", async ({ page }) => {
  const spec = getViewSpec("all-issues")!;
  spec.elements.heading!.props.title = "Release readiness";
  spec.elements.page!.children = spec.elements.page!.children!.filter((id) => id !== "tabs");
  await page.route("**/api/views/all-issues", (route) => route.fulfill({ json: spec }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Release readiness", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Issue scope", exact: true })).toHaveCount(0);
  await expect(page.locator(".jr-issue-row")).toHaveCount(22);
  await page.getByRole("button", { name: "New issue", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "New issue", exact: true })).toBeVisible();
});

test("workspace switching isolates edits and persists the selected workspace", async ({ page }) => {
  await page.goto("/?view=issues&issue=ENG-101");
  await page.getByRole("combobox", { name: "Change status", exact: true }).click();
  await page.getByRole("option", { name: "Done", exact: true }).click();
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
  await expect(page.getByRole("combobox", { name: "Change status", exact: true })).toContainText(
    "In progress",
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
  await expect(page.getByRole("combobox", { name: "Change status", exact: true })).toContainText(
    "Done",
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
  await expect(page.getByRole("combobox", { name: "Change status", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.keyboard.press("Meta+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
