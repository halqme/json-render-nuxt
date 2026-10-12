import { readdirSync, readFileSync } from "node:fs";
import { test, expect } from "./fixtures";

const clientAssets = new URL("../../.output/public/_nuxt/", import.meta.url);

test("production client bundles omit the development-only DevTools bridge", () => {
  const scripts = readdirSync(clientAssets).filter((file) => file.endsWith(".js"));
  expect(scripts.length).toBeGreaterThan(0);
  for (const file of scripts) {
    const source = readFileSync(new URL(file, clientAssets), "utf8");
    expect(source).not.toContain("json-render-spec-cache");
    expect(source).not.toContain("setupDevToolsPlugin");
    expect(source).not.toContain("__spec-cache/");
    expect(source).not.toContain("__JSON_RENDER_SPEC_CACHE__");
    expect(source).not.toContain("Development renderer cache");
  }
});

test("production renderer omits the DevTools bridge and serves every view", async ({ page }) => {
  await page.goto("/?view=issues");
  expect(await page.evaluate(() => Reflect.has(window, "__JSON_RENDER_SPEC_CACHE__"))).toBe(false);
  await expect(page.getByRole("button", { name: "Inspect UI" })).toHaveCount(0);
  await expect(page.locator(".jr-issue-row").first()).toBeVisible();
  await page.goto("/?view=projects");
  await expect(page.getByText("Projects", { exact: true }).first()).toBeVisible();
});
