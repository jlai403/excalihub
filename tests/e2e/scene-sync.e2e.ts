import { test, expect, type APIRequestContext } from "@playwright/test";

function textElement(id: string, text: string, y = 100) {
  return {
    id,
    type: "text",
    x: 100,
    y,
    width: 200,
    height: 25,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: 1,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    fontSize: 20,
    fontFamily: 1,
    text,
    textAlign: "left",
    verticalAlign: "top",
    containerId: null,
    originalText: text,
    lineHeight: 1.25,
    index: `a${y}`,
  };
}

function imageElement(id: string, fileId: string) {
  return {
    id,
    type: "image",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    angle: 0,
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: 2,
    version: 1,
    versionNonce: 2,
    isDeleted: false,
    boundElements: null,
    updated: 2,
    link: null,
    locked: false,
    fileId,
    status: "saved",
    scale: [1, 1],
    crop: null,
    index: "b0",
  };
}

const pngFile = {
  id: "f1",
  mimeType: "image/png",
  dataURL: "data:image/png;base64,AAAA",
  created: 1,
};

interface Space {
  id: string;
  name: string;
  subdomain: string;
}

async function createSpace(request: APIRequestContext, name: string): Promise<Space> {
  const res = await request.post("/api/spaces", { data: { name } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as Space;
}

async function createBackup(
  request: APIRequestContext,
  subdomain: string,
  elements: unknown[],
): Promise<void> {
  const res = await request.post("/api/backup", {
    data: { subdomain, elements: JSON.stringify(elements), appState: JSON.stringify({}) },
  });
  expect(res.ok()).toBeTruthy();
}

async function listBackups(request: APIRequestContext, spaceId: string) {
  return (await request.get(`/api/spaces/${spaceId}/backups`)).json();
}

const spaceUrl = (subdomain: string) =>
  `http://${subdomain}.excalihub.localhost:8081/`;

function storedIds(page: import("@playwright/test").Page) {
  return page.evaluate(() =>
    (JSON.parse(localStorage.getItem("excalidraw") ?? "[]") as { id?: string }[]).map(
      (e) => e.id,
    ),
  );
}

function idbFiles(page: import("@playwright/test").Page, ids: string[]) {
  return page.evaluate(
    (wanted) =>
      (
        window as unknown as {
          __excalihub: { readFilesFromIDB: (ids: string[]) => Promise<Record<string, unknown>> };
        }
      ).__excalihub.readFilesFromIDB(wanted),
    ids,
  );
}

async function restoreViaPrompt(page: import("@playwright/test").Page, action: string) {
  await expect(page.locator("#hub-restore-overlay")).toBeVisible({ timeout: 15_000 });
  await page.locator(`[data-restore-action="${action}"]`).click();
  // The adopted scene reloads, then the boot script re-hashes once Excalidraw's
  // normalization settles. Wait that out before tests touch sync state.
  await page.waitForFunction(
    () =>
      !localStorage.getItem("excalihub-adopting") &&
      !!localStorage.getItem("excalihub-local-hash"),
    null,
    { timeout: 20_000 },
  );
}

test.describe.serial("cross-device scene sync", () => {
  test.beforeAll(async ({ request }) => {
    const spaces = await (await request.get("/api/spaces")).json();
    for (const space of spaces) await request.delete(`/api/spaces/${space.id}`);
    await request.post("/api/git/disconnect").catch(() => {});
  });

  test("prompts on an empty device and restores the latest backup", async ({
    page,
    request,
  }) => {
    const space = await createSpace(request, `Sync Restore ${Date.now()}`);
    await createBackup(request, space.subdomain, [textElement("sync-a", "RESTORED")]);

    await page.goto(spaceUrl(space.subdomain));
    await restoreViaPrompt(page, "backup");

    await expect
      .poll(() => storedIds(page), { timeout: 15_000 })
      .toContain("sync-a");
  });

  test("restores referenced images into IndexedDB", async ({ page, request }) => {
    const space = await createSpace(request, `Sync Images ${Date.now()}`);
    const filesRes = await request.post(`/api/spaces/${space.id}/files`, {
      data: { files: { f1: pngFile } },
    });
    expect(filesRes.ok()).toBeTruthy();
    await createBackup(request, space.subdomain, [imageElement("sync-img", "f1")]);

    await page.goto(spaceUrl(space.subdomain));
    await restoreViaPrompt(page, "backup");

    await expect
      .poll(async () => Object.keys(await idbFiles(page, ["f1"])), { timeout: 15_000 })
      .toContain("f1");
  });

  test("a fresh empty tab never creates a backup", async ({ page, request }) => {
    const space = await createSpace(request, `Sync Empty ${Date.now()}`);
    await page.goto(spaceUrl(space.subdomain));
    await page.waitForTimeout(6500);
    expect(await listBackups(request, space.id)).toHaveLength(0);
  });

  test("auto-pulls a newer server scene when local is clean", async ({ page, request }) => {
    const space = await createSpace(request, `Sync Pull ${Date.now()}`);
    await createBackup(request, space.subdomain, [textElement("pull-a", "A")]);

    await page.goto(spaceUrl(space.subdomain));
    await restoreViaPrompt(page, "backup");
    await expect.poll(() => storedIds(page), { timeout: 15_000 }).toContain("pull-a");

    // Another device saves a newer version while this one is untouched.
    await createBackup(request, space.subdomain, [textElement("pull-b", "B", 200)]);

    await page.reload();
    await expect.poll(() => storedIds(page), { timeout: 15_000 }).toContain("pull-b");
    await expect(page.locator("#hub-restore-overlay")).toHaveCount(0);
  });

  test("prompts on conflict when local has unsynced edits", async ({ page, request }) => {
    const space = await createSpace(request, `Sync Conflict ${Date.now()}`);
    await createBackup(request, space.subdomain, [textElement("conf-a", "A")]);

    await page.goto(spaceUrl(space.subdomain));
    await restoreViaPrompt(page, "backup");
    await expect.poll(() => storedIds(page), { timeout: 15_000 }).toContain("conf-a");

    // Simulate an unsynced local edit: leave the elements as-is but desync the
    // stored local hash (writing localStorage['excalidraw'] directly would be
    // clobbered by the live app's unload flush). Pause the sync loop so it
    // can't reconcile before we reload.
    await page.evaluate(() => {
      const sync = (window as unknown as { __excalihubSync: { pause(): void } }).__excalihubSync;
      sync.pause();
      localStorage.setItem("excalihub-local-hash", "unsynced-edit");
    });

    await createBackup(request, space.subdomain, [textElement("conf-b", "B", 200)]);

    await page.reload();
    await expect(page.locator("#hub-restore-overlay")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-restore-action="load-latest"]')).toBeVisible();
    await expect(page.locator('[data-restore-action="overwrite"]')).toBeVisible();
  });

  test("an idle tab that pushes stale content gets a conflict", async ({ page, request }) => {
    const space = await createSpace(request, `Sync Idle ${Date.now()}`);
    await createBackup(request, space.subdomain, [textElement("idle-a", "A")]);

    await page.goto(spaceUrl(space.subdomain));
    await restoreViaPrompt(page, "backup");
    await expect.poll(() => storedIds(page), { timeout: 15_000 }).toContain("idle-a");

    // Server moves on via another device; this tab never reloads.
    await createBackup(request, space.subdomain, [textElement("idle-b", "B", 200)]);

    // Local edit → the 5s loop pushes it with a stale base version → 409.
    await page.evaluate(() => {
      localStorage.setItem(
        "excalidraw",
        JSON.stringify([{ id: "idle-local", type: "text" }]),
      );
    });
    await expect(page.locator("#hub-restore-overlay")).toBeVisible({ timeout: 30_000 });
  });

  test("images survive in a second browser context", async ({ browser, request }) => {
    const space = await createSpace(request, `Sync CrossDevice ${Date.now()}`);
    await request.post(`/api/spaces/${space.id}/files`, { data: { files: { f1: pngFile } } });
    await createBackup(request, space.subdomain, [imageElement("cross-img", "f1")]);

    const first = await browser.newContext();
    const pageA = await first.newPage();
    await pageA.goto(spaceUrl(space.subdomain));
    await restoreViaPrompt(pageA, "backup");
    await expect.poll(async () => Object.keys(await idbFiles(pageA, ["f1"])), {
      timeout: 15_000,
    }).toContain("f1");
    await first.close();

    // A brand-new device with no storage must get the image back from the store.
    const second = await browser.newContext();
    const pageB = await second.newPage();
    await pageB.goto(spaceUrl(space.subdomain));
    await restoreViaPrompt(pageB, "backup");
    await expect.poll(async () => Object.keys(await idbFiles(pageB, ["f1"])), {
      timeout: 15_000,
    }).toContain("f1");
    await second.close();
  });
});
