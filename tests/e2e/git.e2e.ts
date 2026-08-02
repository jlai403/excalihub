import {
  test,
  expect,
  request as pwRequest,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";

const E2E_GIT_TOKEN = process.env.E2E_GIT_TOKEN;
const E2E_SSH_PRIVATE_KEY = process.env.E2E_SSH_PRIVATE_KEY;
const [owner, repo] = (process.env.E2E_GIT_REPO ?? "jlai403/excalihub-ci").split(
  "/"
);
const repoUrl = `git@github.com:${owner}/${repo}.git`;
const deployKeyTitle = "excalihub-e2e";

let gh: APIRequestContext;
let spaceName = "Git E2E Space";

async function expectOk(res: APIResponse, what: string): Promise<APIResponse> {
  if (!res.ok()) {
    throw new Error(`${what}: ${res.status()} ${await res.text()}`);
  }
  return res;
}

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
    !E2E_GIT_TOKEN || !E2E_SSH_PRIVATE_KEY,
    "E2E_GIT_TOKEN / E2E_SSH_PRIVATE_KEY not set — skipping git integration"
  );

  test.beforeAll(async ({ request }, testInfo) => {
    spaceName = `Git E2E ${testInfo.project.name} ${Date.now()}`;
    console.log(
      `[git.e2e] project=${testInfo.project.name} owner=${owner} repo=${repo} tokenLen=${E2E_GIT_TOKEN?.length ?? 0}`
    );
    const keyRes = await request.get("/api/git/ssh-key");
    expect(keyRes.ok()).toBeTruthy();
    const { publicKey } = await keyRes.json();

    gh = await pwRequest.newContext({
      baseURL: "https://api.github.com",
      extraHTTPHeaders: {
        Authorization: `Bearer ${E2E_GIT_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    const userRes = await expectOk(
      await gh.get("/user"),
      "GitHub /user auth check"
    );
    const me = await userRes.json();
    expect(me.login).toBe("jlai403");

    const spaces = await (await request.get("/api/spaces")).json();
    for (const space of spaces) {
      await request.delete(`/api/spaces/${space.id}`);
    }

    const keysRes = await expectOk(
      await gh.get(`/repos/${owner}/${repo}/keys`),
      "GitHub keys GET"
    );
    const keys = await keysRes.json();

    const fingerprint = (s: string) => s.trim().split(/\s+/).slice(0, 2).join(" ");

    const existing = keys.find(
      (k: { title: string; key: string }) =>
        k.title === deployKeyTitle && fingerprint(k.key) === fingerprint(publicKey)
    );
    if (existing) {
      console.log(
        `[git.e2e] ${testInfo.project.name}: reusing deploy key ${existing.id}`
      );
    } else {
      for (const key of keys.filter(
        (k: { title: string }) => k.title === deployKeyTitle
      )) {
        await gh.delete(`/repos/${owner}/${repo}/keys/${key.id}`);
      }
      const regRes = await gh.post(`/repos/${owner}/${repo}/keys`, {
        data: {
          title: deployKeyTitle,
          key: fingerprint(publicKey),
          read_only: false,
        },
      });
      expectOk(regRes, "Deploy key registration");
      console.log(
        `[git.e2e] ${testInfo.project.name}: registered new deploy key`
      );
    }
  });

  test.afterAll(async ({ request }) => {
    await request.post("/api/git/disconnect").catch(() => {});
    // The excalihub-e2e deploy key is persistent by design — reused (never
    // deleted) across runs to avoid key-change notifications on every run.
    await gh?.dispose();
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

    // The push has completed by now, but the GitHub commits API is
    // eventually consistent — poll until the commit shows up and assert
    // on that same response (a second fetch can race back to stale data).
    await expect
      .poll(
        async () => {
          const res = await gh.get(
            `/repos/${owner}/${repo}/commits?path=${space.subdomain}/`
          );
          if (!res.ok()) return undefined;
          const body = await res.json();
          const commit = Array.isArray(body) && body.length > 0 ? body[0] : undefined;
          return commit?.commit?.message;
        },
        { timeout: 15_000 }
      )
      .toContain("e2e commit");
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
