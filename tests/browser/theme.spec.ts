import type { Locator } from "@playwright/test";
import { test, expect } from "./fixtures";

async function expectReadableText(locator: Locator) {
  const ratio = await locator.evaluate((element) => {
    const channels = (color: string) => (color.match(/[\d.]+/g) ?? []).map(Number);
    const foreground = channels(getComputedStyle(element).color);
    let background: number[] = [255, 255, 255];
    const layers: number[][] = [];
    let node: Element | null = element;
    while (node) {
      const value = channels(getComputedStyle(node).backgroundColor);
      layers.push(value);
      if (value.length === 3 || value[3] === 1) break;
      node = node.parentElement;
    }
    for (const value of layers.reverse()) {
      const alpha = value[3] ?? 1;
      background = value
        .slice(0, 3)
        .map((channel, index) => channel * alpha + background[index]! * (1 - alpha));
    }
    const luminance = (rgb: number[]) =>
      rgb.slice(0, 3).reduce((sum, channel, index) => {
        const value = channel / 255;
        return (
          sum +
          (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) *
            [0.2126, 0.7152, 0.0722][index]!
        );
      }, 0);
    const a = luminance(foreground);
    const b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
}

test("theme changes leave the server issue detail Spec unchanged", async ({ page, request }) => {
  await page.goto("/?view=issues");
  await expect(page.locator(".jr-issue-row").first()).toBeVisible();
  await page.getByRole("textbox", { name: "Search issues", exact: true }).fill("ENG-101");
  await expect(page.locator(".jr-issue-row")).toHaveCount(1);
  await page
    .getByRole("button", { name: "ENG-101: Fix session expiry during workspace switching" })
    .click();
  const original = await (
    await request.get("/api/views/issue-detail?workspace=orbit&issue=ENG-101")
  ).json();
  await expect(page.getByRole("button", { name: "Inspect UI", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Switch to light mode", exact: true }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  expect(
    await (await request.get("/api/views/issue-detail?workspace=orbit&issue=ENG-101")).json(),
  ).toEqual(original);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Switch to dark mode", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "Switch to dark mode", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Switch to light mode", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

for (const mode of ["light", "dark"] as const) {
  test(`${mode} theme covers all views, overlays and 320px layout`, async ({ page }) => {
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(error.message));
    await page.goto("/?view=issues");
    await expect(page.locator(".jr-issue-row").first()).toBeVisible();
    if (mode === "light")
      await page.getByRole("button", { name: "Switch to light mode", exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: `Switch to ${mode === "light" ? "dark" : "light"} mode`,
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.locator("html").evaluate((element) => getComputedStyle(element).colorScheme),
    ).toBe(mode);
    expect(
      await page
        .locator(".orbit-shell")
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    ).toBe(mode === "light" ? "rgb(255, 255, 255)" : "rgb(23, 23, 25)");
    await expectReadableText(page.locator(".jr-page-heading p"));
    await expectReadableText(page.locator(".jr-group-count").first());
    await expectReadableText(page.locator(".jr-issue-id").first());
    const row = page.locator(".jr-issue-row").first();
    await row.hover();
    await row.getByRole("checkbox").check();
    await row.hover();
    await expectReadableText(row.locator(".jr-issue-id"));
    await row.getByRole("checkbox").uncheck();
    await page.mouse.move(0, 0);
    await page.screenshot({
      path: `test-results/theme-${mode}-issues.png`,
      fullPage: true,
      animations: "disabled",
    });

    const navigation = page.getByRole("navigation", { name: "Workspace", exact: true });
    await navigation.getByRole("button", { name: "My issues", exact: true }).click();
    await expect(page.getByRole("heading", { name: "My issues", exact: true })).toBeVisible();
    await navigation.getByRole("button", { name: "Projects", exact: true }).click();
    await expect(page.locator(".jr-project-card")).toHaveCount(4);
    await expectReadableText(page.locator(".jr-project-description").first());
    await page.screenshot({
      path: `test-results/theme-${mode}-projects.png`,
      fullPage: true,
      animations: "disabled",
    });
    await navigation.getByRole("button", { name: "All issues", exact: true }).click();
    await page
      .getByRole("button", { name: "ENG-101: Fix session expiry during workspace switching" })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Fix session expiry during workspace switching",
        exact: true,
      }),
    ).toBeVisible();
    await expectReadableText(page.locator(".jr-text-body"));
    await page.screenshot({
      path: `test-results/theme-${mode}-detail.png`,
      fullPage: true,
      animations: "disabled",
    });

    await page.getByRole("button", { name: "Search workspace (Command or Control K)" }).click();
    const search = page.getByRole("dialog", { name: "Search workspace", exact: true });
    await expect(search.getByRole("combobox")).toBeVisible();
    await expectReadableText(search.locator(".result-copy small").first());
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Create new issue", exact: true }).last().click();
    const dialog = page.getByRole("dialog", { name: "New issue", exact: true });
    await expect(dialog).toBeVisible();
    await expectReadableText(dialog.locator(".issue-context"));
    await expectReadableText(dialog.locator('[data-slot="fallback"]'));
    await dialog
      .getByRole("textbox", { name: "Issue title (required)", exact: true })
      .fill("Theme draft");
    const submit = dialog.getByRole("button", { name: "Create issue", exact: true });
    await submit.hover();
    await expectReadableText(submit);
    await page.mouse.move(0, 0);
    await page.screenshot({
      path: `test-results/theme-${mode}-modal.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.keyboard.press("Escape");

    await expect(page.getByRole("button", { name: "Inspect UI", exact: true })).toHaveCount(0);
    await page.setViewportSize({ width: 320, height: 740 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await expect(
      page.getByRole("button", {
        name: `Switch to ${mode === "light" ? "dark" : "light"} mode`,
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/theme-${mode}-mobile.png`,
      fullPage: true,
      animations: "disabled",
    });
    expect(failures).toEqual([]);
  });
}
