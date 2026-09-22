import "./varlock";
import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { rmSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const FRAMES_DIR = "tests/e2e/demo-results/frames";

// Mirrors git.e2e.ts: Bun auto-loads .env.local, so without varlock this var
// holds the bare `exec('op read ...')` expression. Only a real OpenSSH key
// (from `varlock run` via `demo:local`/`demo:gif:local`, or CI) enables the
// git-connect + commit frames.
const E2E_SSH_PRIVATE_KEY = process.env.E2E_SSH_PRIVATE_KEY?.startsWith(
  "-----BEGIN OPENSSH PRIVATE KEY-----"
)
  ? process.env.E2E_SSH_PRIVATE_KEY
  : undefined;
const hasGit = !!E2E_SSH_PRIVATE_KEY;
const [owner, repo] = (process.env.E2E_GIT_REPO ?? "jlai403/excalihub-ci").split(
  "/"
);
const repoUrl = `git@github.com:${owner}/${repo}.git`;

// Fully-formed elements: real Excalidraw drops malformed ones on import.
function textEl(
  id: string,
  text: string,
  x: number,
  y: number,
  stroke: string,
  fontSize = 22
) {
  return {
    id,
    type: "text",
    x,
    y,
    width: Math.max(120, text.length * fontSize * 0.55),
    height: fontSize * 1.25,
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
    fontSize,
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

function shapeEl(
  id: string,
  type: "rectangle" | "ellipse",
  x: number,
  y: number,
  width: number,
  height: number,
  stroke: string,
  strokeWidth = 2
) {
  return {
    id,
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: stroke,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: type === "rectangle" ? { type: 3 } : null,
    seed: 2,
    version: 1,
    versionNonce: 2,
    isDeleted: false,
    boundElements: null,
    updated: 2,
    link: null,
    locked: false,
    index: `b${y}`,
  };
}

const RECOVERY_SCENE = [
  textEl("recovery-a", "Design v2 — recovery point", 120, 130, "#8364ff", 26),
  shapeEl("recovery-b", "rectangle", 200, 240, 180, 100, "#1ba1ff"),
];
const WEEKLY_SCENE = [
  textEl("weekly-a", "Weekly checkpoint", 120, 130, "#da70d6", 22),
  shapeEl("weekly-b", "ellipse", 260, 240, 140, 90, "#fe9b10"),
];
const MONTHLY_SCENE = [
  textEl("monthly-a", "Monthly snapshot", 120, 130, "#666666", 22),
];

const DAYS = 86_400_000;

function writeBackupFile(space: { subdomain: string }, ageMs: number, scene: unknown[]): void {
  const dir = join(process.cwd(), "data-e2e", "spaces", space.subdomain, "backups");
  mkdirSync(dir, { recursive: true });
  const ts = Date.now() - ageMs;
  const filename = `${ts}-demoabcd-11110000.excalidraw`;
  writeFileSync(
    join(dir, filename),
    JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "https://excalihub",
      elements: scene,
      appState: {},
      files: {},
    })
  );
}

async function seedBackups(
  space: { subdomain: string },
  request: APIRequestContext
): Promise<string> {
  const appState = JSON.stringify({ name: null, viewBackgroundColor: "#ffffff" });
  const res = await request.post("/api/backup", {
    data: { subdomain: space.subdomain, elements: JSON.stringify(RECOVERY_SCENE), appState },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { success: true; filename?: string; deduplicated?: boolean };
  const dailyFilename = body.filename!;

  writeBackupFile(space, 10 * DAYS, WEEKLY_SCENE);
  writeBackupFile(space, 60 * DAYS, MONTHLY_SCENE);
  return dailyFilename;
}

async function openPalette(page: Page) {
  await page.evaluate(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        metaKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
  });
}

async function paletteAction(page: Page, query: string, optionName: string) {
  await openPalette(page);
  const input = page.getByPlaceholder("Type a command or search...");
  await expect(input).toBeVisible();
  await input.fill(query);
  await page.getByRole("option", { name: optionName, exact: true }).click();
}

async function addCaption(page: Page, text: string) {
  await page.evaluate((t) => {
    document.getElementById("demo-caption")?.remove();
    const style = getComputedStyle(document.documentElement);
    // Space pages run the real Excalidraw, which doesn't define the hub's
    // --background/--foreground/--border vars; fall back to a neutral pill.
    const background = style.getPropertyValue("--background").trim() || "220 23% 95%";
    const foreground = style.getPropertyValue("--foreground").trim() || "234 16% 35%";
    const border = style.getPropertyValue("--border").trim() || "223 16% 83%";
    const pill = document.createElement("div");
    pill.id = "demo-caption";
    pill.textContent = t;
    Object.assign(pill.style, {
      position: "fixed",
      left: "50%",
      bottom: "40px",
      transform: "translateX(-50%)",
      zIndex: "9999",
      fontFamily: "var(--font-sans)",
      fontWeight: "600",
      fontSize: "26px",
      letterSpacing: "0.01em",
      whiteSpace: "nowrap",
      // Inverted from the hub theme: dark theme → light pill with dark text;
      // light theme → dark pill with light text.
      color: `hsl(${background})`,
      background: `color-mix(in srgb, hsl(${foreground}) 88%, transparent)`,
      border: `1px solid hsl(${border})`,
      borderRadius: "999px",
      padding: "12px 28px",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
    });
    document.body.appendChild(pill);
  }, text);
  await expect(page.locator("#demo-caption")).toBeVisible();
}

async function gotoSpace(page: Page, request: APIRequestContext) {
  const spaces = await (await request.get("/api/spaces")).json();
  const space = spaces.find((s: { name: string }) => s.name === "My Project");
  await page.goto(`http://${space.subdomain}.excalihub.localhost:8081/`);
  await expect(page).toHaveTitle("My Project · Excalidraw");
}

test("demo", async ({ page, request }) => {
  rmSync(FRAMES_DIR, { recursive: true, force: true });
  mkdirSync(FRAMES_DIR, { recursive: true });

  const res = await request.get("/api/spaces");
  const spaces = await res.json();
  for (const space of spaces) {
    await request.delete(`/api/spaces/${space.id}`);
  }
  // Reset any stale git connection (e.g. from a surviving server) so the
  // settings page always shows the connect form in frame 7.
  await request.post("/api/git/disconnect");

  await page.addInitScript(() => {
    localStorage.setItem("sidebar-pinned", "true");
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Frame 1 — empty state
  await expect(page.getByRole("main").getByText("No spaces yet")).toBeVisible();
  await addCaption(page, "Empty dashboard");
  await page.screenshot({ path: `${FRAMES_DIR}/frame-01.png` });

  // Frame 2 — command palette open
  await openPalette(page);
  await expect(page.getByPlaceholder("Type a command or search...")).toBeVisible();
  await addCaption(page, "⌘ + K to get started");
  await page.screenshot({ path: `${FRAMES_DIR}/frame-02.png` });

  // Frame 3 — fuzzy search filtering
  await page.getByPlaceholder("Type a command or search...").fill("dark");
  await expect(page.getByRole("option", { name: "Dark" })).toBeVisible();
  await addCaption(page, "Fuzzy search any action");
  await page.screenshot({ path: `${FRAMES_DIR}/frame-03.png` });

  // Frame 4 — dark mode applied
  await page.getByRole("option", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await addCaption(page, "Dark mode applied");
  await page.screenshot({ path: `${FRAMES_DIR}/frame-04.png` });

  // Frame 5 — create space dialog
  await page.getByRole("button", { name: "Create Space" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.getByLabel("Space Name").fill("My Project");
  await page.waitForTimeout(300);
  await addCaption(page, "Create a space");
  await page.screenshot({ path: `${FRAMES_DIR}/frame-05.png` });

  // Frame 6 — space appears in list
  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("link", { name: "My Project", exact: true })).toBeVisible();
  await addCaption(page, "Isolated workspace ready");
  await page.screenshot({ path: `${FRAMES_DIR}/frame-06.png` });

  // Seed the backup tier set for My Project: one daily backup via the API
  // (the only previewable one — it's in the in-memory backupIndex) plus
  // weekly/monthly files written straight to disk. The scene-pinning init
  // script makes the 5s auto-backup dedup against the seeded daily so the
  // modal stays at exactly 3 rows.
  const freshSpaces = await (await request.get("/api/spaces")).json();
  const backupSpace = freshSpaces.find(
    (s: { name: string }) => s.name === "My Project"
  );
  await page.addInitScript(
    (arg: { subdomain: string; scene: unknown[] }) => {
      if (location.hostname.startsWith(arg.subdomain + ".")) {
        localStorage.setItem("excalidraw", JSON.stringify(arg.scene));
        localStorage.setItem(
          "excalidraw-state",
          '{"name":null,"viewBackgroundColor":"#ffffff"}'
        );
      }
    },
    { subdomain: backupSpace.subdomain, scene: RECOVERY_SCENE }
  );
  const dailyBackupFilename = await seedBackups(backupSpace, request);

  // Frame 7 — hub card backups dialog grouped by retention tier
  const card = page.locator('[data-slot="card"]').filter({ hasText: "My Project" });
  await card.locator('[data-backups-button="true"]').click();
  const backupsDialog = page.getByRole("dialog");
  await expect(backupsDialog).toBeVisible();
  await expect(backupsDialog.locator('[data-backup-tier="daily"]')).toHaveText("Daily");
  await expect(backupsDialog.locator('[data-backup-tier="weekly"]')).toHaveText("Weekly");
  await expect(backupsDialog.locator('[data-backup-tier="monthly"]')).toHaveText("Monthly");
  await expect(backupsDialog.locator("[data-backup-row]")).toHaveCount(3);
  await addCaption(page, "Every save is versioned");
  await page.screenshot({ path: `${FRAMES_DIR}/frame-07.png` });

  // Frame 8 — open the space, ExcaliHub menu → Backups modal (tiered)
  await page.keyboard.press("Escape");
  await gotoSpace(page, request);
  const menuBtn = page.locator(".ex-menu-btn");
  await expect(menuBtn).toBeVisible();
  await menuBtn.click();
  await page.locator(".ex-menu-item").filter({ hasText: "Backups", exact: true }).click();
  const backupsOverlay = page.locator("#hub-backups-overlay");
  await expect(backupsOverlay).toBeVisible();
  await expect(backupsOverlay.locator("[data-backup-tier='daily']")).toHaveText("Daily");
  await expect(backupsOverlay.locator(".ex-backups__row")).toHaveCount(3);
  await addCaption(page, "Restore from the whiteboard");
  await page.screenshot({ path: `${FRAMES_DIR}/frame-08.png` });

  // Frame 9 — backup preview page shows the recovery scene with banner
  await page.goto(
    `http://backup.excalihub.localhost:8081/?space=${backupSpace.subdomain}&backup=${dailyBackupFilename}`
  );
  await expect(page.locator("#hub-backup-preview")).toContainText("Viewing backup");
  const previewScene = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("excalidraw") ?? "[]")
  );
  expect(previewScene).toContainEqual(expect.objectContaining({ id: "recovery-a" }));
  await addCaption(page, "Preview any saved version");
  await page.screenshot({ path: `${FRAMES_DIR}/frame-09.png` });

  if (hasGit) {
    // Frame 10 — settings: connect the real git repository. Must precede the
    // space-page load: the proxy computes __GIT_ENABLED per request.
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await paletteAction(page, "settings", "Settings");
    await expect(page.getByRole("heading", { name: "SSH Public Key" })).toBeVisible();
    await page.getByLabel("Repository URL").fill(repoUrl);
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    const confirmDialog = page.getByRole("dialog");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(page.getByText("Connected", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await addCaption(page, "Connect a git repository");
    await page.screenshot({ path: `${FRAMES_DIR}/frame-10.png` });

    // Frame 11 — open the space: proxy serves the whiteboard subdomain with
    // the injected ExcaliHub menu / commit modal / sync scripts.
    await gotoSpace(page, request);
    const menuBtn = page.locator(".ex-menu-btn");
    await expect(menuBtn).toBeVisible();
    await addCaption(page, "Open a whiteboard");
    await page.screenshot({ path: `${FRAMES_DIR}/frame-11.png` });

    // Frame 12 — injected ExcaliHub menu dropdown open (Commit to Git enabled)
    await menuBtn.click();
    const commitItem = page.locator(".ex-menu-item").filter({ hasText: "Commit to Git" });
    await expect(commitItem).toBeVisible();
    await expect(commitItem).toBeEnabled();
    await addCaption(page, "ExcaliHub menu");
    await page.screenshot({ path: `${FRAMES_DIR}/frame-12.png` });

    // Frame 13 — commit modal opens
    await commitItem.click();
    const overlay = page.locator("#hub-commit-modal-overlay");
    await expect(overlay).toBeVisible();
    await expect(page.locator("#hub-commit-modal-message")).toHaveValue(
      /^Update my-project /
    );
    await addCaption(page, "Commit to git");
    await page.screenshot({ path: `${FRAMES_DIR}/frame-13.png` });

    // Frame 14 — commit lands, dashboard shows the synced badge
    await overlay.getByRole("button", { name: "Commit", exact: true }).click();
    await expect(overlay.getByText("Committed successfully!")).toBeVisible();
    await page.waitForTimeout(1800);
    await page.goto("/");
    const card = page.locator('[data-slot="card"]').filter({ hasText: "My Project" });
    await expect(card.getByText(/Update my-project /)).toBeVisible();
    await addCaption(page, "Changes pushed to git");
    await page.screenshot({ path: `${FRAMES_DIR}/frame-14.png` });
  } else {
    // Frame 10 — open the space and show the injected hub menu (Commit to Git
    // stays disabled without a connected repo).
    await gotoSpace(page, request);
    const menuBtn = page.locator(".ex-menu-btn");
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();
    const commitItem = page.locator(".ex-menu-item").filter({ hasText: "Commit to Git" });
    await expect(commitItem).toBeVisible();
    await expect(commitItem).toBeDisabled();
    await addCaption(page, "Open a whiteboard");
    await page.screenshot({ path: `${FRAMES_DIR}/frame-10.png` });

    // Frame 11 — back to dashboard
    await page.goto("/");
    await expect(page.getByRole("link", { name: "My Project", exact: true })).toBeVisible();
    await addCaption(page, "All your spaces at a glance");
    await page.screenshot({ path: `${FRAMES_DIR}/frame-11.png` });
  }
});