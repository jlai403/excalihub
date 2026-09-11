import "./varlock";
import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const E2E_SSH_PRIVATE_KEY = process.env.E2E_SSH_PRIVATE_KEY?.startsWith(
  "-----BEGIN OPENSSH PRIVATE KEY-----"
)
  ? process.env.E2E_SSH_PRIVATE_KEY
  : undefined;
const [owner, repo] = (
  process.env.E2E_GIT_REPO ?? "jlai403/excalihub-ci"
).split("/");
const repoUrl = `git@github.com:${owner}/${repo}.git`;

async function openPalette(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("hub-open-palette"));
  });
}

async function pressPaletteShortcut(page: Page): Promise<void> {
  await page.keyboard.press("Meta+Shift+k");
}

async function spaceSubdomain(
  request: APIRequestContext,
  name: string,
): Promise<string> {
  const res = await request.post("/api/spaces", { data: { name } });
  expect(res.ok()).toBeTruthy();
  const space = await res.json();
  return space.subdomain;
}

test.describe.serial("ExcaliHub palette", () => {
  test.beforeAll(async ({ request }) => {
    const res = await request.get("/api/spaces");
    const spaces = await res.json();
    for (const space of spaces) {
      await request.delete(`/api/spaces/${space.id}`);
    }
    await request.post("/api/git/disconnect").catch(() => {});
  });

  test("opens via ⌘⇧K", async ({ page, request }) => {
    const sub = await spaceSubdomain(request, "Palette Open");
    await page.goto(`http://${sub}.excalihub.localhost:8081/`);
    await expect(page.locator("#hub-palette-overlay")).not.toBeVisible();
    await pressPaletteShortcut(page);
    await expect(page.locator("#hub-palette-overlay")).toBeVisible();
  });

  test("closes via Escape", async ({ page, request }) => {
    const sub = await spaceSubdomain(request, "Palette Close");
    await page.goto(`http://${sub}.excalihub.localhost:8081/`);
    await openPalette(page);
    await expect(page.locator("#hub-palette-overlay")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#hub-palette-overlay")).not.toBeVisible();
  });

  test("lists active spaces", async ({ page, request }) => {
    const subA = await spaceSubdomain(request, "Palette Space A");
    const subB = await spaceSubdomain(request, "Palette Space B");
    await page.goto(`http://${subA}.excalihub.localhost:8081/`);
    await openPalette(page);
    await expect(
      page.locator(".ex-palette__item").filter({ hasText: "Palette Space B" })
    ).toBeVisible();
    await expect(
      page.locator(".ex-palette__item").filter({ hasText: "Palette Space A" })
    ).toHaveCount(0);
  });

  test("switch space navigates same-tab", async ({ page, request }) => {
    const subA = await spaceSubdomain(request, "Palette Switch A");
    const subB = await spaceSubdomain(request, "Palette Switch B");
    await page.goto(`http://${subA}.excalihub.localhost:8081/`);
    await openPalette(page);
    await expect(page.locator("#hub-palette-overlay")).toBeVisible();
    await page
      .locator(".ex-palette__item")
      .filter({ hasText: "Palette Switch B" })
      .click();
    await expect(page).toHaveURL(new RegExp(`${subB}\\.excalihub\\.localhost`));
  });

  test("commit to git disabled when disconnected", async ({
    page,
    request,
  }) => {
    const sub = await spaceSubdomain(request, "Palette No Git");
    await page.goto(`http://${sub}.excalihub.localhost:8081/`);
    await openPalette(page);
    await expect(page.locator("#hub-palette-overlay")).toBeVisible();
    const commitItem = page
      .locator(".ex-palette__item")
      .filter({ hasText: "Commit to Git" });
    await expect(commitItem).toHaveClass(/ex-palette__item--disabled/);
  });

  test("opens dropdown command palette item", async ({ page, request }) => {
    const sub = await spaceSubdomain(request, "Palette Dropdown");
    await page.goto(`http://${sub}.excalihub.localhost:8081/`);
    await expect(page.locator(".ex-menu-btn")).toBeVisible();
    await page.locator(".ex-menu-btn").click();
    await page
      .locator(".ex-menu-item")
      .filter({ hasText: "Command palette" })
      .click();
    await expect(page.locator("#hub-palette-overlay")).toBeVisible();
  });

  test("repo item hidden when disconnected", async ({ page, request }) => {
    const sub = await spaceSubdomain(request, "Palette No Repo");
    await page.goto(`http://${sub}.excalihub.localhost:8081/`);
    await openPalette(page);
    await expect(page.locator("#hub-palette-overlay")).toBeVisible();
    await expect(
      page.locator(".ex-palette__item").filter({ hasText: "Repo" })
    ).toHaveCount(0);
  });

  test.describe.serial("git-connected palette", () => {
    test.skip(!E2E_SSH_PRIVATE_KEY, "E2E_SSH_PRIVATE_KEY not set");

    let gitSub: string;

    test.beforeAll(async ({ request }, testInfo) => {
      if (!E2E_SSH_PRIVATE_KEY) return;
      gitSub = await spaceSubdomain(
        request,
        `Git Palette ${testInfo.project.name} ${Date.now()}`
      );
      const res = await request.post("/api/git/connect", {
        data: { repoUrl },
      });
      expect(res.ok()).toBeTruthy();
    });

    test.afterAll(async ({ request }) => {
      await request.post("/api/git/disconnect").catch(() => {});
    });

    test("commit modal opens on commit action", async ({ page }) => {
      await page.goto(`http://${gitSub}.excalihub.localhost:8081/`);
      await openPalette(page);
      await expect(page.locator("#hub-palette-overlay")).toBeVisible();
      await page
        .locator(".ex-palette__item")
        .filter({ hasText: "Commit to Git" })
        .click();
      await expect(page.locator("#hub-commit-modal-overlay")).toBeVisible();
    });

    test("repo item links correctly when connected", async ({ page }) => {
      await page.goto(`http://${gitSub}.excalihub.localhost:8081/`);
      await page.evaluate(() => {
        const w = window as unknown as {
          __openedUrls: string[];
          open: (url: string) => void;
        };
        w.__openedUrls = [];
        w.open = (url: string) => {
          w.__openedUrls.push(url);
        };
      });
      await openPalette(page);
      await expect(page.locator("#hub-palette-overlay")).toBeVisible();
      const repoItem = page
        .locator(".ex-palette__item")
        .filter({ hasText: "Repo" });
      await expect(repoItem).toBeVisible();
      await repoItem.dispatchEvent("mousedown");
      const urls = await page.evaluate(
        () =>
          (window as unknown as { __openedUrls: string[] }).__openedUrls
      );
      expect(urls[0]).toBe(`https://github.com/${owner}/${repo}`);
    });
  });
});
