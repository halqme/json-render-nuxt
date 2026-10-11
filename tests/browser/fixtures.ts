import { test as base, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { initialIssues, initialActivities } from "../../shared/mock-data";

export const test = base.extend<{ resetRecords: void }>({
  resetRecords: [
    async ({ baseURL }, use) => {
      if (baseURL !== "http://127.0.0.1:3100") throw new Error("Use the isolated test server");
      // The server uses only this dedicated test directory, never the user's .data.
      mkdirSync("test-results/records", { recursive: true });
      for (const workspace of ["orbit", "sandbox"]) {
        writeFileSync(
          `test-results/records/${workspace}.json`,
          JSON.stringify({
            issues: initialIssues,
            activities: initialActivities,
          }),
        );
      }
      await use();
    },
    { auto: true },
  ],
});
export { expect };
