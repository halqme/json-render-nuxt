import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { initialIssues, initialActivities } from "../../shared/mock-data";
import { performWorkflowAction } from "../../server/utils/personas";
import { loadRecords, mutateRecords, updateIssue, type Records } from "../../server/utils/records";
import { test, expect } from "./fixtures";

test("records only accept loopback Host independently of Origin", async ({ request }) => {
  const base = "/api/workspaces/orbit";
  for (const host of ["evil.example:3100", "localhost.evil.example", "192.168.1.2"]) {
    const headers = { host, origin: `http://${host}` };
    expect((await request.get(`${base}/records`, { headers })).status()).toBe(403);
    expect(
      (await request.post(`${base}/issues`, { headers, data: { title: "Rebinding" } })).status(),
    ).toBe(403);
  }
  for (const host of ["localhost:3100", "127.0.0.1:3100", "[::1]:3100"]) {
    expect((await request.get(`${base}/records`, { headers: { host } })).status()).toBe(200);
  }
});

test("invalid persisted graphs and unknown metadata fail closed without changing bytes", async ({
  request,
}) => {
  const file = "test-results/records/orbit.json";
  const before = readFileSync(file);
  const seed = { issues: initialIssues, activities: initialActivities };
  const corruptions = [
    { ...seed, metadata: { version: 2 } },
    { ...seed, issues: [{ ...initialIssues[0], metadata: true }, ...initialIssues.slice(1)] },
    { ...seed, activities: [{ ...initialActivities[0], metadata: true }] },
    { ...seed, issues: [...initialIssues, initialIssues[0]] },
    { ...seed, activities: [...initialActivities, initialActivities[0]] },
    ...["other", "ENG-NaN", "ENG-001", "ENG-9007199254740992"].map((id) => ({
      issues: [{ ...initialIssues[0], id }],
      activities: [],
    })),
    { ...seed, issues: [{ ...initialIssues[0], createdAt: "2026-02-30T00:00:00Z" }] },
    { ...seed, activities: [{ ...initialActivities[0], createdAt: "yesterday" }] },
    { ...seed, activities: [{ ...initialActivities[0], author: "unknown" }] },
    { ...seed, activities: [{ ...initialActivities[0], issueId: "ENG-999" }] },
    { ...seed, activities: [{ ...initialActivities[0], id: "" }] },
  ];
  try {
    for (const records of corruptions) {
      const bytes = JSON.stringify(records, null, 2) + "\n";
      writeFileSync(file, bytes);
      expect((await request.get("/api/workspaces/orbit/records")).status()).toBe(500);
      expect(
        (
          await request.post("/api/workspaces/orbit/issues", { data: { title: "No overwrite" } })
        ).status(),
      ).toBe(500);
      expect(readFileSync(file, "utf8")).toBe(bytes);
    }
    const exhausted = JSON.stringify({
      issues: [{ ...initialIssues[0], id: `ENG-${Number.MAX_SAFE_INTEGER}` }],
      activities: [],
    });
    writeFileSync(file, exhausted);
    expect((await request.get("/api/workspaces/orbit/records")).status()).toBe(200);
    expect(
      (
        await request.post("/api/workspaces/orbit/issues", { data: { title: "No unsafe ID" } })
      ).status(),
    ).toBe(500);
    expect(readFileSync(file, "utf8")).toBe(exhausted);
  } finally {
    writeFileSync(file, before);
  }
});

test("API validates mutations and persists server-generated records independently", async ({
  request,
}) => {
  const base = "/api/workspaces/orbit";
  expect((await request.get("/api/workspaces/unknown/records")).status()).toBe(400);
  expect(
    (
      await request.post(`${base}/issues`, {
        data: { title: "Cross-origin" },
        headers: { origin: "https://example.com" },
      })
    ).status(),
  ).toBe(403);
  expect((await request.post(`${base}/issues`, { form: { title: "Form post" } })).status()).toBe(
    415,
  );
  for (const input of [
    {},
    { title: " " },
    { title: "x", status: "invalid" },
    { title: "x", assignee: "missing" },
    { title: "x", project: "missing" },
    { title: "x", id: "forged" },
    { title: "x", status: "Done" },
    { title: "x", labels: [1] },
  ]) {
    expect((await request.post(`${base}/issues`, { data: input })).status()).toBe(400);
  }
  const before = await (await request.get(`${base}/records`)).json();
  const nextNumber =
    Math.max(100, ...before.issues.map((issue: { id: string }) => Number(issue.id.slice(4)))) + 1;
  const created = await request.post(`${base}/issues`, { data: { title: "  Persist this  " } });
  expect(created.ok()).toBe(true);
  const { issue } = await created.json();
  expect(issue.title).toBe("Persist this");
  expect(issue.id).toMatch(/^ENG-[1-9][0-9]*$/);
  expect(issue.id).toBe(`ENG-${nextNumber}`);
  expect(before.issues.some((record: { id: string }) => record.id === issue.id)).toBe(false);
  expect((await request.patch(`${base}/issues/${issue.id}`, { data: {} })).status()).toBe(400);
  expect(
    (await request.patch(`${base}/issues/${issue.id}`, { data: { createdAt: "forged" } })).status(),
  ).toBe(400);
  expect(
    (await request.patch(`${base}/issues/missing`, { data: { status: "Done" } })).status(),
  ).toBe(403);
  expect(
    (await request.post(`${base}/issues/${issue.id}/comments`, { data: { text: " " } })).status(),
  ).toBe(400);
  expect(
    (await request.post(`${base}/issues/missing/comments`, { data: { text: "hello" } })).status(),
  ).toBe(404);
  expect(
    (await request.patch(`${base}/issues/${issue.id}`, { data: { status: "Done" } })).status(),
  ).toBe(403);
  expect(
    (
      await request.post(`${base}/issues/${issue.id}/workflow`, {
        data: { action: "approve" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post(`${base}/issues/${issue.id}/workflow`, {
        data: { action: "start-work" },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await request.post(`${base}/issues/${issue.id}/workflow`, {
        data: { action: "request-review" },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await request.post(`${base}/issues/${issue.id}/workflow`, {
        data: { action: "approve" },
      })
    ).status(),
  ).toBe(403);
  await request.post("/api/demo/persona", { data: { persona: "manager" } });
  expect(
    (
      await request.post(`${base}/issues/${issue.id}/workflow`, {
        data: { action: "approve" },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await request.post(`${base}/issues/${issue.id}/workflow`, {
        data: { action: "approve" },
      })
    ).status(),
  ).toBe(409);
  const comment = await request.post(`${base}/issues/${issue.id}/comments`, {
    data: { text: "  Kept on disk  " },
  });
  expect(comment.ok()).toBe(true);
  const records = await (await request.get(`${base}/records`)).json();
  const activities = records.activities.filter((a: { issueId: string }) => a.issueId === issue.id);
  expect(activities.map((a: { text: string }) => a.text)).toEqual([
    "Created this issue.",
    "Changed status from Todo to In progress.",
    "Changed status from In progress to In review.",
    "Changed status from In review to Done.",
    "Kept on disk",
  ]);
  expect(new Set(activities.map((a: { id: string }) => a.id)).size).toBe(5);
  expect(records).toEqual(JSON.parse(readFileSync("test-results/records/orbit.json", "utf8")));
  const sandbox = await (await request.get("/api/workspaces/sandbox/records")).json();
  expect(sandbox.issues).toHaveLength(22);
});

test("a delayed mutation body cannot overwrite a completed workflow approval", async () => {
  const directory = mkdtempSync(resolve("test-results/mutation-race-"));
  const dataDirectory = process.env.ORBIT_DATA_DIR;
  const records: Records = {
    issues: structuredClone(initialIssues),
    activities: structuredClone(initialActivities),
  };
  const inputIssue = records.issues.find((issue) => issue.id === "ENG-102")!;
  inputIssue.status = "In review";
  writeFileSync(resolve(directory, "orbit.json"), JSON.stringify(records));
  process.env.ORBIT_DATA_DIR = directory;

  let resolvePatchBody!: (input: { priority: "Low" }) => void;
  const delayedBody = new Promise<{ priority: "Low" }>((resolveBody) => {
    resolvePatchBody = resolveBody;
  });
  try {
    const patch = mutateRecords("orbit", delayedBody, (current, input) =>
      updateIssue(current, "ENG-102", input, "sam"),
    );
    await mutateRecords(
      "orbit",
      Promise.resolve({ action: "approve" as const }),
      (current, input) => performWorkflowAction(current, "manager", "ENG-102", input.action),
    );

    resolvePatchBody({ priority: "Low" });
    await patch;

    const approvedIssue = loadRecords("orbit").issues.find((issue) => issue.id === "ENG-102");
    expect(approvedIssue).toMatchObject({ status: "Done", priority: "Low" });
  } finally {
    if (dataDirectory === undefined) delete process.env.ORBIT_DATA_DIR;
    else process.env.ORBIT_DATA_DIR = dataDirectory;
    rmSync(directory, { recursive: true, force: true });
  }
});

test("guest reads are filtered and direct endpoint bypasses remain denied", async ({ request }) => {
  await request.post("/api/demo/persona", { data: { persona: "guest" } });
  const base = "/api/workspaces/orbit";
  const records = await (await request.get(`${base}/records`)).json();
  expect(records.issues).toHaveLength(17);
  expect(records.issues.some((issue: { project: string }) => issue.project === "design")).toBe(
    false,
  );
  expect(
    records.activities.every((activity: { issueId: string }) =>
      records.issues.some((issue: { id: string }) => issue.id === activity.issueId),
    ),
  ).toBe(true);

  const projectData = await (await request.get(`${base}/projects`)).json();
  expect(projectData.projects.map((project: { id: string }) => project.id)).not.toContain("design");
  expect(projectData.projects).toHaveLength(3);
  expect(
    (await request.get("/api/views/issue-detail?workspace=orbit&issue=ENG-117")).status(),
  ).toBe(404);
  expect(
    (await request.get("/api/views/issue-detail?workspace=orbit&issue=ENG-101")).status(),
  ).toBe(200);

  expect(
    (await request.patch(`${base}/issues/ENG-101`, { data: { priority: "Low" } })).status(),
  ).toBe(403);
  expect(
    (await request.patch(`${base}/issues/ENG-117`, { data: { priority: "Low" } })).status(),
  ).toBe(404);
  expect(
    (
      await request.post(`${base}/issues/ENG-101/comments`, {
        data: { text: "Guest bypass attempt" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post(`${base}/issues/ENG-117/comments`, {
        data: { text: "Hidden issue bypass attempt" },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await request.patch(`${base}/issues/ENG-101`, {
        data: { project: "design" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post(`${base}/issues`, {
        data: { title: "Guest create", project: "design" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post(`${base}/issues/ENG-102/workflow`, {
        data: { action: "approve" },
      })
    ).status(),
  ).toBe(403);

  await request.post("/api/demo/persona", { data: { persona: "employee" } });
  expect(
    (await request.get("/api/views/issue-detail?workspace=orbit&issue=ENG-117")).status(),
  ).toBe(200);
});

test("disk write failure leaves persisted records unchanged", async ({ request }) => {
  const file = "test-results/records/orbit.json";
  const before = readFileSync(file, "utf8");
  // A directory at the temporary file location forces a real filesystem write failure.
  mkdirSync(`${file}.tmp`);
  try {
    const response = await request.post("/api/workspaces/orbit/issues", {
      data: { title: "Must not be reported saved" },
    });
    expect(response.status()).toBe(500);
    expect(readFileSync(file, "utf8")).toBe(before);
    expect((await (await request.get("/api/workspaces/orbit/records")).json()).issues).toHaveLength(
      22,
    );
  } finally {
    rmSync(`${file}.tmp`, { recursive: true });
  }
});

test("server restart retains issues, comments and history", async ({ playwright }) => {
  const directory = resolve(mkdtempSync("test-results/restart-"));
  const client = await playwright.request.newContext({ baseURL: "http://127.0.0.1:3101" });
  const start = async () => {
    const child = spawn("bun", [".output/server/index.mjs"], {
      env: {
        ...process.env,
        NITRO_HOST: "127.0.0.1",
        NITRO_PORT: "3101",
        ORBIT_DATA_DIR: directory,
      },
      stdio: "ignore",
    });
    try {
      await expect
        .poll(async () => {
          if (child.exitCode !== null) throw new Error("Restart test server exited");
          return client
            .get("/api/workspaces/orbit/records")
            .then((r) => r.status())
            .catch(() => 0);
        })
        .toBe(200);
      return child;
    } catch (error) {
      child.kill();
      throw error;
    }
  };
  let server = await start();
  try {
    const base = "/api/workspaces/orbit";
    const { issue } = await (
      await client.post(`${base}/issues`, { data: { title: "Restart survivor" } })
    ).json();
    await client.patch(`${base}/issues/${issue.id}`, { data: { priority: "High" } });
    await client.post(`${base}/issues/${issue.id}/comments`, { data: { text: "Still here" } });
    const before = await (await client.get(`${base}/records`)).json();
    const stopped = once(server, "exit");
    server.kill();
    await stopped;
    server = await start();
    expect(await (await client.get(`${base}/records`)).json()).toEqual(before);
    // Corruption must fail closed, not silently overwrite existing records with samples.
    writeFileSync(`${directory}/orbit.json`, "{broken");
    expect((await client.get(`${base}/records`)).status()).toBe(500);
    expect(readFileSync(`${directory}/orbit.json`, "utf8")).toBe("{broken");
  } finally {
    const stopped = once(server, "exit");
    server.kill();
    await stopped;
    await client.dispose();
  }
});

test("failed saves retain drafts and authoritative property values", async ({ page }) => {
  await page.goto("/?issue=ENG-101");
  await expect(page.getByRole("combobox", { name: "Change priority", exact: true })).toContainText(
    "Urgent",
  );
  await page.route("**/api/workspaces/orbit/issues/**", (route) =>
    route.fulfill({ status: 500, body: "{}" }),
  );
  await page.getByRole("combobox", { name: "Change priority", exact: true }).click();
  await page.getByRole("option", { name: "High", exact: true }).click();
  await expect(page.getByText(/Save could not be confirmed/)).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Change priority", exact: true })).toContainText(
    "Urgent",
  );
  await page.getByRole("textbox", { name: "Comment", exact: true }).fill("Keep my comment");
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  await expect(page.getByText(/Save could not be confirmed/)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Comment", exact: true })).toHaveValue(
    "Keep my comment",
  );
  await page.route("**/api/workspaces/orbit/issues", (route) =>
    route.fulfill({ status: 500, body: "{}" }),
  );
  await page.getByRole("button", { name: "Back to issues", exact: true }).click();
  await page.getByRole("button", { name: "New issue", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New issue", exact: true });
  await dialog
    .getByRole("textbox", { name: "Issue title (required)", exact: true })
    .fill("Keep my issue");
  await dialog.getByRole("button", { name: "Create issue", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(
    dialog.getByRole("textbox", { name: "Issue title (required)", exact: true }),
  ).toHaveValue("Keep my issue");
});

test("record load failure is reported without substituting samples", async ({ page }) => {
  await page.route("**/api/workspaces/orbit/records", (route) =>
    route.fulfill({ status: 500, body: "{}" }),
  );
  await page.goto("/");
  await expect(page.getByText(/Records could not be loaded/)).toBeVisible();
  await expect(page.locator(".jr-issue-row")).toHaveCount(0);
  await page.unroute("**/api/workspaces/orbit/records");
  await page.reload();
  await expect(page.locator(".jr-issue-row")).toHaveCount(22);
});
