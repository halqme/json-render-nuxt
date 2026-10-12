import { expect, test } from "@playwright/test";

test("sidebar Spec Cache applies an override, preserves it across refetch, then clears to the new server Spec", async ({
  page,
}) => {
  let issueDetailRequests = 0;
  let refetching = false;
  type TestSpec = {
    elements: Record<string, { props?: Record<string, unknown> }>;
    [key: string]: unknown;
  };
  let originalServerSpec: TestSpec | undefined;
  const requestMethods: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/")) requestMethods.push(request.method());
  });
  await page.route("**/api/**", async (route) => {
    if (!new URL(route.request().url()).pathname.endsWith("/api/views/issue-detail")) {
      await route.continue();
      return;
    }
    issueDetailRequests++;
    const response = await route.fetch();
    const serverSpec = (await response.json()) as TestSpec;
    originalServerSpec ??= serverSpec;
    if (refetching) {
      const button = serverSpec.elements["workflow-advance"];
      if (button?.props) button.props.label = "Server refetch verified";
    }
    await route.fulfill({ response, json: serverSpec });
  });

  await page.goto("/");
  await page
    .getByRole("button", { name: /ENG-104: Audit API rate limit response headers/ })
    .click();
  await expect(
    page.getByText("Audit API rate limit response headers", { exact: true }).first(),
  ).toBeVisible();
  expect(originalServerSpec).toBeTruthy();
  expect(originalServerSpec?.elements["workflow-advance"]?.props?.label).toBe("Start work");
  const overrideSpec = structuredClone(originalServerSpec!);
  overrideSpec.elements["workflow-advance"]!.props!.label = "Spec Cache override verified";
  const overrideJSON = JSON.stringify(overrideSpec);

  await page.locator("nuxt-devtools-frame").evaluate((element) => {
    element.shadowRoot
      ?.querySelector<HTMLButtonElement>('button[title="Toggle Nuxt DevTools"]')
      ?.click();
  });
  const devtools = page.frameLocator("#nuxt-devtools-iframe");
  const getStarted = devtools.getByText("Get Started", { exact: true });
  const specCacheLink = devtools.getByRole("link", { name: "Spec Cache" });
  await expect(getStarted.or(specCacheLink)).toBeVisible();
  if (await getStarted.isVisible()) await getStarted.click();
  await expect(specCacheLink).toBeVisible();
  await specCacheLink.click();
  const panel = devtools.frameLocator('iframe[src="/__spec-cache/"]');
  await expect(panel.getByRole("heading", { name: "Spec Cache" })).toBeVisible();
  const devtoolsIsDark = await devtools
    .locator("html")
    .evaluate((root) => root.classList.contains("dark"));
  await expect
    .poll(() => panel.locator("html").evaluate((root) => getComputedStyle(root).colorScheme))
    .toBe(devtoolsIsDark ? "dark" : "light");
  await expect(panel.getByLabel("Cached view")).toContainText("ENG-104");
  await panel.getByLabel("Draft JSON").fill("{");
  await panel.getByRole("button", { name: "Apply draft", exact: true }).click();
  await expect(panel.locator('[aria-live="polite"]')).not.toBeEmpty();
  await expect(page.getByRole("button", { name: "Start work", exact: true })).toBeVisible();
  expect(
    await (await page.request.get("/api/views/issue-detail?workspace=orbit&issue=ENG-104")).json(),
  ).toEqual(originalServerSpec);
  await panel.getByLabel("Draft JSON").fill(JSON.stringify(JSON.parse(overrideJSON), null, 2));
  await panel.getByRole("button", { name: "Apply draft", exact: true }).click();
  await expect(
    panel.getByText("Override applied to the Renderer. Server Spec unchanged."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Spec Cache override verified" })).toBeVisible();
  expect(requestMethods.filter((method) => method !== "GET")).toEqual([]);
  expect(
    await (await page.request.get("/api/views/issue-detail?workspace=orbit&issue=ENG-104")).json(),
  ).toEqual(originalServerSpec);

  const requestsBeforeRefetch = issueDetailRequests;
  refetching = true;
  await panel.getByRole("button", { name: "Refetch", exact: true }).click();
  await expect.poll(() => issueDetailRequests).toBeGreaterThan(requestsBeforeRefetch);
  await expect(panel.getByText("Refetch complete; any override is retained.")).toBeVisible();
  await expect(panel.getByText(/Override active/)).toBeVisible();
  await expect(panel.getByLabel("Draft JSON")).toHaveValue(/Spec Cache override verified/);
  await panel.locator(".spec-view").nth(0).locator("summary").click();
  await expect(panel.locator(".spec-view").nth(0)).toContainText("Server refetch verified");
  await panel.locator(".spec-view").nth(1).locator("summary").click();
  await expect(panel.locator(".spec-view").nth(1)).toContainText("Spec Cache override verified");
  await panel.locator(".spec-view").nth(2).locator("summary").click();
  await expect(panel.locator(".spec-view").nth(2)).toContainText("Spec Cache override verified");
  expect(
    await (await page.request.get("/api/views/issue-detail?workspace=orbit&issue=ENG-104")).json(),
  ).toEqual(originalServerSpec);

  const cachedView = panel.getByLabel("Cached view");
  const issueIdentity = await cachedView.inputValue();
  const otherIdentity = await cachedView
    .locator("option")
    .evaluateAll(
      (options, currentIdentity) =>
        options
          .map((option) => option as HTMLOptionElement)
          .find((option) => option.value !== currentIdentity)?.value,
      issueIdentity,
    );
  expect(otherIdentity).toBeTruthy();
  const unsavedDraft = structuredClone(overrideSpec);
  unsavedDraft.elements["workflow-advance"]!.props!.label = "Unsaved identity draft";
  await panel.getByLabel("Draft JSON").fill(JSON.stringify(unsavedDraft, null, 2));
  await cachedView.selectOption(otherIdentity!);
  await cachedView.selectOption(issueIdentity);
  await expect(panel.getByLabel("Draft JSON")).toHaveValue(/Unsaved identity draft/);
  await panel.getByLabel("Draft JSON").fill(JSON.stringify(overrideSpec, null, 2));

  await panel.getByRole("button", { name: "Clear override", exact: true }).click();
  await expect(page.getByRole("button", { name: "Server refetch verified" })).toBeVisible();
  await expect(panel.getByText(/Using server Spec/)).toBeVisible();
  await expect(panel.getByRole("heading", { name: /Request history/ })).toBeVisible();

  const requestsBeforeInvalidate = issueDetailRequests;
  await panel.getByRole("button", { name: "Invalidate & refetch", exact: true }).click();
  await expect.poll(() => issueDetailRequests).toBeGreaterThan(requestsBeforeInvalidate);
  await expect(panel.getByText("Cache invalidated and refetched.")).toBeVisible();
  await expect(panel.locator(".spec-view").nth(0)).toContainText("Server refetch verified");
  await expect(page.getByRole("button", { name: "Server refetch verified" })).toBeVisible();
  expect(requestMethods.filter((method) => method !== "GET")).toEqual([]);
  expect(
    await (await page.request.get("/api/views/issue-detail?workspace=orbit&issue=ENG-104")).json(),
  ).toEqual(originalServerSpec);
  await page.screenshot({ path: "test-results/nuxt-spec-cache.png" });
});
