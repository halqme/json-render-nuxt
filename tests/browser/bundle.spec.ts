import { test, expect } from "./fixtures";
import { readdirSync, statSync } from "node:fs";

const clientAssets = new URL("../../.output/public/_nuxt/", import.meta.url);

test("production JavaScript chunks stay within the 500 kB budget", () => {
  const scripts = readdirSync(clientAssets).filter((file) => file.endsWith(".js"));
  expect(scripts.length).toBeGreaterThan(0);
  for (const file of scripts) {
    expect(statSync(new URL(file, clientAssets)).size, file).toBeLessThanOrEqual(500_000);
  }
});

test("issue detail inspector and composer load on demand and reuse downloaded chunks", async ({
  page,
}) => {
  const scripts: string[] = [];
  const sources: Promise<string>[] = [];
  const failures: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") scripts.push(request.url());
  });
  page.on("response", (response) => {
    if (response.request().resourceType() === "script") {
      sources.push(
        response.text().catch((error: Error) => {
          failures.push(error.message);
          return "";
        }),
      );
    }
  });
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(message.text());
  });
  await page.goto("/?view=issues");
  await expect(page.locator(".jr-issue-row").first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  const initialScripts = scripts.length;
  const initialSources = await Promise.all(sources);
  expect(initialSources.some((source) => source.includes("ui-spec-json"))).toBe(false);
  expect(initialSources.some((source) => source.includes("orbit-issue-title"))).toBe(false);

  await page
    .getByRole("button", { name: "ENG-101: Fix session expiry during workspace switching" })
    .click();
  await page.getByRole("button", { name: "Inspect UI", exact: true }).click();
  const inspector = page.getByRole("complementary", { name: "Inspect UI", exact: true });
  await expect(inspector.getByRole("textbox", { name: "UI Spec JSON" })).toHaveValue(
    /WorkflowPanel/,
  );
  expect(scripts.length).toBeGreaterThan(initialScripts);
  expect((await Promise.all(sources)).some((source) => source.includes("ui-spec-json"))).toBe(true);
  const afterInspect = scripts.length;
  await inspector.getByRole("button", { name: "Close Inspect UI" }).click();
  await page.getByRole("button", { name: "Inspect UI", exact: true }).click();
  await expect(inspector).toBeVisible();
  expect(scripts.length).toBe(afterInspect);
  await inspector.getByRole("button", { name: "Close Inspect UI" }).click();

  await page.getByRole("button", { name: "Back to issues", exact: true }).click();
  await page.getByRole("button", { name: "New issue", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New issue", exact: true });
  await expect(dialog).toBeVisible();
  expect(scripts.length).toBeGreaterThan(afterInspect);
  expect((await Promise.all(sources)).some((source) => source.includes("orbit-issue-title"))).toBe(
    true,
  );
  const afterComposer = scripts.length;
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "New issue", exact: true }).click();
  await expect(dialog).toBeVisible();
  expect(scripts.length).toBe(afterComposer);
  expect(failures).toEqual([]);
});
