import "./varlock";
import {
  test,
  expect,
  type APIRequestContext,
} from "@playwright/test";
import { execFileSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Bun auto-loads .env.local, so without varlock this var holds the bare
// `exec('op read ...')` expression, not a usable key. Only a real OpenSSH
// private key (from `varlock run` locally or the CI secret) enables the spec.
const E2E_SSH_PRIVATE_KEY = process.env.E2E_SSH_PRIVATE_KEY?.startsWith(
  "-----BEGIN OPENSSH PRIVATE KEY-----"
)
  ? process.env.E2E_SSH_PRIVATE_KEY
  : undefined;
const [owner, repo] = (process.env.E2E_GIT_REPO ?? "jlai403/excalihub-ci").split(
  "/"
);
const repoUrl = `git@github.com:${owner}/${repo}.git`;

let spaceName = "Git E2E Space";

async function findSpace(request: APIRequestContext, name: string) {
  const spaces = await (await request.get("/api/spaces")).json();
  return spaces.find((s: { name: string }) => s.name === name) ?? null;
}

async function ensureSpace(request: APIRequestContext, name: string) {
  const existing = await findSpace(request, name);
  if (existing) await request.delete(`/api/spaces/${existing.id}`);

  const res = await request.post("/api/spaces", { data: { name } });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

async function createBackup(
  request: APIRequestContext,
  subdomain: string,
  elements: string
) {
  const res = await request.post("/api/backup", {
    data: { subdomain, elements, appState: null },
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

test.describe.serial("git integration", () => {
  test.skip(
    !E2E_SSH_PRIVATE_KEY,
    "E2E_SSH_PRIVATE_KEY not set — skipping git integration"
  );

  test.beforeAll(async ({ request }, testInfo) => {
    spaceName = `Git E2E ${testInfo.project.name} ${Date.now()}`;
    console.log(`[git.e2e] project=${testInfo.project.name}`);

    const spaces = await (await request.get("/api/spaces")).json();
    for (const space of spaces) {
      await request.delete(`/api/spaces/${space.id}`);
    }
  });

  test.afterAll(async ({ request }) => {
    await request.post("/api/git/disconnect").catch(() => {});
  });

  test("rejects an invalid repository URL", async ({ page }) => {
    await page.goto("/settings");
    await page.getByLabel("Repository URL").fill("https://github.com/foo/bar");
    await page.getByRole("button", { name: "Connect", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Connect", exact: true }).click();

    await expect(page.getByText(/Invalid repository URL/)).toBeVisible();
  });

  test("connects to the e2e GitHub repository", async ({ page }) => {
    await page.goto("/settings");
    await page.getByLabel("Repository URL").fill(repoUrl);
    await page.getByRole("button", { name: "Connect", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Connect", exact: true }).click();

    await expect(page.getByText("Connected", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(repoUrl)).toBeVisible();
  });

  test("shows no-commits state before any commit", async ({ page, request }) => {
    const space = await ensureSpace(request, spaceName);
    await createBackup(request, space.subdomain, "[]");

    await page.goto("/");
    const card = page.locator('[data-slot="card"]').filter({ hasText: spaceName });
    await expect(card).toBeVisible();
    await expect(card.getByText("No commits yet")).toBeVisible();
  });

  test("commits and shows synced state", async ({ page, request }) => {
    const space = await findSpace(request, spaceName);
    expect(space).toBeTruthy();

    const commitRes = await request.post("/api/git/commit", {
      data: {
        subdomain: space.subdomain,
        excalidrawData: JSON.stringify({ elements: [] }),
        message: "e2e commit",
      },
    });
    expect(commitRes.ok()).toBeTruthy();

    await page.goto("/");
    const card = page.locator('[data-slot="card"]').filter({ hasText: spaceName });
    await expect(card.getByText("e2e commit")).toBeVisible();
  });

  test("shows unsaved changes after a newer backup", async ({ page, request }) => {
    const space = await findSpace(request, spaceName);
    expect(space).toBeTruthy();

    await createBackup(request, space.subdomain, '[{"id":"1"}]');

    await page.goto("/");
    const card = page.locator('[data-slot="card"]').filter({ hasText: spaceName });
    await expect(card.getByText("· unsaved changes")).toBeVisible();
  });

  test("pushes the commit to the remote repository", async ({ request }) => {
    const space = await findSpace(request, spaceName);
    expect(space).toBeTruthy();

    // Verify the push landed by fetching over SSH with the seeded deploy
    // key (git is strongly consistent, unlike the GitHub REST API).
    // A standalone temp repo keeps this independent of the app's git state.
    // The key is re-materialized from E2E_SSH_PRIVATE_KEY into the temp dir
    // (host-owned, 0600) rather than reading the container-owned key at
    // data-e2e/git-config/id_ed25519, which the host user can't read on CI.
    const tmp = mkdtempSync(join(tmpdir(), "excalihub-e2e-"));
    try {
      const sshKey = join(tmp, "id_ed25519");
      const rawKey = process.env.E2E_SSH_PRIVATE_KEY ?? "";
      writeFileSync(sshKey, rawKey.endsWith("\n") ? rawKey : `${rawKey}\n`);
      chmodSync(sshKey, 0o600);
      // IdentityAgent=none: macOS ssh offers agent keys (e.g. the developer's
      // own GitHub key) BEFORE -i despite IdentitiesOnly=yes, which authenticates
      // as the wrong user and fails the fetch with "Repository not found".
      const sshCommand = `ssh -i ${sshKey} -o IdentitiesOnly=yes -o IdentityAgent=none -o StrictHostKeyChecking=no`;

      execFileSync("git", ["init", "-b", "main"], { cwd: tmp, stdio: "pipe" });
      execFileSync("git", ["remote", "add", "origin", repoUrl], {
        cwd: tmp,
        stdio: "pipe",
      });

      await expect
        .poll(
          async () => {
            try {
              execFileSync("git", ["fetch", "origin", "main"], {
                cwd: tmp,
                stdio: "pipe",
                env: { ...process.env, GIT_SSH_COMMAND: sshCommand },
              });
              const out = execFileSync(
                "git",
                [
                  "log",
                  "-1",
                  "--format=%s",
                  "FETCH_HEAD",
                  "--",
                  `${space.subdomain}/`,
                ],
                { cwd: tmp, stdio: "pipe", encoding: "utf8" }
              );
              return out.trim();
            } catch {
              return undefined;
            }
          },
          { timeout: 15_000 }
        )
        .toContain("e2e commit");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("disconnects and returns to the connect form", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "Disconnect", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("button", { name: "Disconnect", exact: true })
      .click();

    await expect(page.getByLabel("Repository URL")).toBeVisible();
    await expect(page.getByText("Connected", { exact: true })).not.toBeVisible();
  });
});
