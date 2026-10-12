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

test("the production app has no inline Inspector and retains lazy composer loading", async ({
  page,
}) => {
  const scripts: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") scripts.push(request.url());
  });
  await page.goto("/?view=issues");
  await expect(page.locator(".jr-issue-row").first()).toBeVisible();
  expect(await page.getByRole("button", { name: "Inspect UI" }).count()).toBe(0);
  const initialScripts = scripts.length;
  await page
    .getByRole("button", { name: "ENG-101: Fix session expiry during workspace switching" })
    .click();
  await page.getByRole("button", { name: "Back to issues", exact: true }).click();
  await page.getByRole("button", { name: "New issue", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "New issue", exact: true })).toBeVisible();
  expect(scripts.length).toBeGreaterThan(initialScripts);
});
