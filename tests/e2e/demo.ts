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

const RECOVERY_SCENE = [
  { id: "recovery-a", type: "text", text: "Design v2 — recovery point", x: 120, y: 130, stroke: "#8364ff", fontSize: 26 },
  { id: "recovery-b", type: "rectangle", x: 200, y: 240, width: 180, height: 100, stroke: "#1ba1ff", strokeWidth: 2 },
];
const WEEKLY_SCENE = [
  { id: "weekly-a", type: "text", text: "Weekly checkpoint", x: 120, y: 130, stroke: "#da70d6", fontSize: 22 },
  { id: "weekly-b", type: "ellipse", x: 260, y: 240, width: 140, height: 90, stroke: "#fe9b10", strokeWidth: 2 },
];
const MONTHLY_SCENE = [
  { id: "monthly-a", type: "text", text: "Monthly snapshot", x: 120, y: 130, stroke: "#666666", fontSize: 22 },
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
      color: `hsl(${style.getPropertyValue("--background")})`,
      background: `color-mix(in srgb, hsl(${style.getPropertyValue("--foreground")}) 88%, transparent)`,
      border: `1px solid hsl(${style.getPropertyValue("--border")})`,
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

  if (hasGit) {
    // Frame 7 — settings: connect the real git repository. Must precede the
    // space-page load: the proxy computes __GIT_ENABLED per request.
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
    await page.screenshot({ path: `${FRAMES_DIR}/frame-07.png` });

    // Frame 8 — open the space: proxy serves the whiteboard subdomain with
    // the injected ExcaliHub menu / commit modal / sync scripts.
    await gotoSpace(page, request);
    const menuBtn = page.locator(".ex-menu-btn");
    await expect(menuBtn).toBeVisible();
    await addCaption(page, "Open a whiteboard");
    await page.screenshot({ path: `${FRAMES_DIR}/frame-08.png` });

    // Frame 9 — injected ExcaliHub menu dropdown open (Commit to Git enabled)
    await menuBtn.click();
    const commitItem = page.locator(".ex-menu-item").filter({ hasText: "Commit to Git" });
    await expect(commitItem).toBeVisible();
    await expect(commitItem).toBeEnabled();
    await addCaption(page, "ExcaliHub menu");
    await page.screenshot({ path: `${FRAMES_DIR}/frame-09.png` });

    // Frame 10 — commit modal opens
    await commitItem.click();
    const overlay = page.locator("#hub-commit-modal-overlay");
    await expect(overlay).toBeVisible();
    await expect(page.locator("#hub-commit-modal-message")).toHaveValue(
      /^Update my-project /
    );
    await addCaption(page, "Commit to git");
    await page.screenshot({ path: `${FRAMES_DIR}/frame-10.png` });

    // Frame 11 — commit lands, dashboard shows the synced badge
    await overlay.getByRole("button", { name: "Commit", exact: true }).click();
    await expect(overlay.getByText("Committed successfully!")).toBeVisible();
    await page.waitForTimeout(1800);
    await page.goto("/");
    const card = page.locator('[data-slot="card"]').filter({ hasText: "My Project" });
    await expect(card.getByText(/Update my-project /)).toBeVisible();
    await addCaption(page, "Changes pushed to git");
    await page.screenshot({ path: `${FRAMES_DIR}/frame-11.png` });
  } else {
    // Frame 7 — open the space and show the injected hub menu (Commit to Git
    // stays disabled without a connected repo).
    await gotoSpace(page, request);
    const menuBtn = page.locator(".ex-menu-btn");
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();
    const commitItem = page.locator(".ex-menu-item").filter({ hasText: "Commit to Git" });
    await expect(commitItem).toBeVisible();
    await expect(commitItem).toBeDisabled();
    await addCaption(page, "Open a whiteboard");
    await page.screenshot({ path: `${FRAMES_DIR}/frame-07.png` });

    // Frame 8 — back to dashboard
    await page.goto("/");
    await expect(page.getByRole("link", { name: "My Project", exact: true })).toBeVisible();
    await addCaption(page, "All your spaces at a glance");
    await page.screenshot({ path: `${FRAMES_DIR}/frame-08.png` });
  }
});