import "./varlock";
import { test, expect, type APIRequestContext } from "@playwright/test";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// A fully-formed Excalidraw text element. Real Excalidraw runs the scene
// through restoreElements on boot and silently drops malformed elements, so
// fixtures must carry every field the app expects or they vanish.
function textElement(id: string, text: string, y = 100, stroke = "#1e1e1e") {
  return {
    id,
    type: "text",
    x: 100,
    y,
    width: 200,
    height: 25,
    angle: 0,
    strokeColor: stroke,
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

function sceneA() {
  return [textElement("scene-aa", "BACKUP A SCENE", 100)];
}

function sceneB() {
  return [textElement("scene-bb", "BACKUP B SCENE", 220, "#ff0000")];
}

const DAYS = 86_400_000;

interface Space {
  id: string;
  name: string;
  subdomain: string;
}

// The 7-4-12 retention policy keeps one backup per day, so two API backups
// made seconds apart collapse to one. Seed files directly on disk to
// exercise multi-row + multi-tier rendering (mirrors backups from older days).
async function seedOldBackup(space: Space, ageMs: number, id: string, text: string): Promise<string> {
  const dir = join(process.cwd(), "data-e2e", "spaces", space.subdomain, "backups");
  mkdirSync(dir, { recursive: true });
  const oldTs = Date.now() - ageMs;
  const filename = `${oldTs}-seed09x9-1234abcd.excalidraw`;
  writeFileSync(
    join(dir, filename),
    JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "https://excalihub",
      elements: [textElement(id, text, 50)],
      appState: {},
      files: {},
    })
  );
  return filename;
}

async function createSpace(request: APIRequestContext, name: string): Promise<Space> {
  const res = await request.post("/api/spaces", { data: { name } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as Space;
}

async function createBackup(
  request: APIRequestContext,
  subdomain: string,
  elements: unknown[]
): Promise<void> {
  const res = await request.post("/api/backup", {
    data: {
      subdomain,
      elements: JSON.stringify(elements),
      appState: JSON.stringify({}),
    },
  });
  expect(res.ok()).toBeTruthy();
}

async function listBackups(
  request: APIRequestContext,
  spaceId: string
): Promise<{ filename: string; createdAt: string }[]> {
  const res = await request.get(`/api/spaces/${spaceId}/backups`);
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as { filename: string; createdAt: string }[];
}

test.describe.serial("backups", () => {
  test.beforeAll(async ({ request }) => {
    const res = await request.get("/api/spaces");
    const spaces = await res.json();
    for (const space of spaces) {
      await request.delete(`/api/spaces/${space.id}`);
    }
  });

  test("the backup subdomain is reserved", async ({ request }) => {
    const res = await request.post("/api/spaces", { data: { name: "Backup" } });
    expect(res.status()).toBe(400);
  });

  test("hub card dialog groups backups by retention tier", async ({ page, request }) => {
    const space = await createSpace(request, "Backups Card");
    await createBackup(request, space.subdomain, sceneA());
    await seedOldBackup(space, 2 * DAYS, "scene-old", "OLD SCENE");
    const weeklyFilename = await seedOldBackup(space, 10 * DAYS, "scene-week-1", "WEEKLY SCENE");
    const monthlyFilename = await seedOldBackup(space, 60 * DAYS, "scene-month-1", "MONTHLY SCENE");

    await page.goto("/");
    const card = page.locator('[data-slot="card"]').filter({ hasText: space.name });
    await card.locator('[data-backups-button="true"]').click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-backup-row]')).toHaveCount(4);

    await expect(dialog.locator('[data-backup-tier="daily"]')).toHaveCount(1);
    await expect(dialog.locator('[data-backup-tier="weekly"]')).toHaveCount(1);
    await expect(dialog.locator('[data-backup-tier="monthly"]')).toHaveCount(1);
    await expect(dialog.locator('[data-backup-tier="daily"]')).toHaveText("Daily");
    await expect(dialog.locator('[data-backup-tier="weekly"]')).toHaveText("Weekly");
    await expect(dialog.locator('[data-backup-tier="monthly"]')).toHaveText("Monthly");
    await expect(dialog.locator('[data-backup-group="daily"] [data-backup-row]')).toHaveCount(2);
    await expect(dialog.locator('[data-backup-group="weekly"] [data-backup-row]')).toHaveCount(1);
    await expect(dialog.locator('[data-backup-group="monthly"] [data-backup-row]')).toHaveCount(1);

    await dialog
      .locator(`[data-backup-row="${weeklyFilename}"]`)
      .locator('[data-backup-delete="true"]')
      .click();
    await expect(dialog.locator('[data-backup-row]')).toHaveCount(3);
    await expect(dialog.locator('[data-backup-tier="weekly"]')).toHaveCount(0);

    const backups = await listBackups(request, space.id);
    expect(backups).toHaveLength(3);
    expect(backups.map((b) => b.filename)).not.toContain(weeklyFilename);
    expect(backups.map((b) => b.filename)).toContain(monthlyFilename);
  });

  test("backup origin previews the scene", async ({ page, request }) => {
    const space = await createSpace(request, "Backups Preview");
    await createBackup(request, space.subdomain, sceneA());
    const [backup] = await listBackups(request, space.id);

    await page.goto(`http://backup.excalihub.localhost:8081/?space=${space.subdomain}&backup=${backup.filename}`);

    await expect(page.locator("#hub-backup-preview")).toBeVisible();
    await expect(page.locator("#hub-backup-preview")).toContainText("Viewing backup");

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("excalidraw") ?? "[]"));
    expect(stored).toContainEqual(expect.objectContaining({ id: "scene-aa" }));
  });

  test("subsequent previews still show the preview bar", async ({ page, request }) => {
    const first = await createSpace(request, "Backups Preview 1");
    await createBackup(request, first.subdomain, sceneA());
    const [firstBackup] = await listBackups(request, first.id);

    const second = await createSpace(request, "Backups Preview 2");
    await createBackup(request, second.subdomain, sceneB());
    const [secondBackup] = await listBackups(request, second.id);

    const url = (space: string, filename: string) =>
      `http://backup.excalihub.localhost:8081/?space=${space}&backup=${filename}`;

    await page.goto(url(first.subdomain, firstBackup.filename));
    await expect(page.locator("#hub-backup-preview")).toBeVisible();
    await expect(page.locator("#hub-backup-preview")).toContainText("Viewing backup");

    await page.goto(url(second.subdomain, secondBackup.filename));
    await expect(page.locator("#hub-backup-preview")).toBeVisible();

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("excalidraw") ?? "[]"));
    expect(stored).toContainEqual(expect.objectContaining({ id: "scene-bb" }));

    await page.goto(url(first.subdomain, firstBackup.filename));
    await expect(page.locator("#hub-backup-preview")).toBeVisible();

    const firstStored = await page.evaluate(() => JSON.parse(localStorage.getItem("excalidraw") ?? "[]"));
    expect(firstStored).toContainEqual(expect.objectContaining({ id: "scene-aa" }));
  });

  test("backup preview opens a minimal command palette", async ({ page, request }) => {
    const space = await createSpace(request, "Palette On Backup");
    await createBackup(request, space.subdomain, sceneA());
    const [backup] = await listBackups(request, space.id);

    await page.goto(`http://backup.excalihub.localhost:8081/?space=${space.subdomain}&backup=${backup.filename}`);
    await expect(page.locator("#hub-backup-preview")).toBeVisible();

    await page.keyboard.press("Meta+Shift+k");
    await expect(page.locator("#hub-palette-overlay")).toBeVisible();
    await expect(
      page.locator(".ex-palette__item").filter({ hasText: "Palette On Backup" })
    ).toHaveCount(1);
    await expect(
      page.locator(".ex-palette__item").filter({ hasText: "Back to ExcaliHub" })
    ).toHaveCount(1);
    await expect(
      page.locator(".ex-palette__item").filter({ hasText: "Commit to Git" })
    ).toHaveCount(0);
    await expect(
      page.locator(".ex-palette__item").filter({ hasText: /^Repo$/ })
    ).toHaveCount(0);
  });

  test("restore from a space overwrites the live scene", async ({ page, request }) => {
    const space = await createSpace(request, "Backups Restore");
    await createBackup(request, space.subdomain, sceneB());

    page.on("dialog", (dialog) => dialog.accept());

    await page.goto(`http://${space.subdomain}.excalihub.localhost:8081/`);
    let stored = await page.evaluate(() => JSON.parse(localStorage.getItem("excalidraw") ?? "[]"));
    expect(stored).not.toContainEqual(expect.objectContaining({ id: "scene-bb" }));

    await page.evaluate(() => window.dispatchEvent(new CustomEvent("hub-open-backups-modal")));
    await expect(page.locator("#hub-backups-overlay")).toBeVisible();
    await expect(page.locator(".ex-backups__row")).toHaveCount(1);
    await expect(page.locator("[data-backup-tier='daily']")).toHaveText("Daily");

    await page.locator(".ex-backups__row").getByRole("button", { name: "Restore" }).click();

    await expect
      .poll(
        async () =>
          page.evaluate(() =>
            (JSON.parse(localStorage.getItem("excalidraw") ?? "[]") as { id?: string }[]).some(
              (e) => e.id === "scene-bb"
            )
          ),
        { timeout: 15_000 }
      )
      .toBe(true);
  });
});