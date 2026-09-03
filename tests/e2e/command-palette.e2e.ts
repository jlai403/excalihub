import { test, expect, type Page } from "@playwright/test";

async function openPalette(page: Page) {
  await page.evaluate(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        ctrlKey: true,
        metaKey: false,
        bubbles: true,
        cancelable: true,
      })
    );
  });
}

test.describe.serial("command-palette", () => {
  test.beforeAll(async ({ request }) => {
    const res = await request.get("/api/spaces");
    const spaces = await res.json();
    for (const space of spaces) {
      await request.delete(`/api/spaces/${space.id}`);
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("sidebar-pinned", "true");
    });
  });

  test("Ctrl+K opens the palette", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByPlaceholder("Type a command or search...")).not.toBeVisible();
    await openPalette(page);
    await expect(page.getByPlaceholder("Type a command or search...")).toBeVisible();
  });

  test("Fuzzy filter narrows results", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await openPalette(page);
    await expect(page.getByPlaceholder("Type a command or search...")).toBeVisible();

    await page.getByPlaceholder("Type a command or search...").fill("dark");

    await expect(page.getByRole("option", { name: "Dark" })).toBeVisible();
    await expect(page.getByText("No results found.")).not.toBeVisible();
  });

  test("Theme selection closes palette and applies dark class", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const html = page.locator("html");

    await openPalette(page);
    await expect(page.getByPlaceholder("Type a command or search...")).toBeVisible();

    await page.getByPlaceholder("Type a command or search...").fill("dark");
    await page.getByRole("option", { name: "Dark" }).click();

    await expect(page.getByPlaceholder("Type a command or search...")).not.toBeVisible();
    await expect(html).toHaveClass(/dark/);
  });

  test("Navigate action goes to Settings", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await openPalette(page);
    await expect(page.getByPlaceholder("Type a command or search...")).toBeVisible();

    await page.getByPlaceholder("Type a command or search...").fill("settings");
    await page.getByRole("option", { name: "Settings", exact: true }).click();

    await expect(page).toHaveURL(/\/settings/);
  });

  test("Create Space from palette opens the dialog", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await openPalette(page);
    await expect(page.getByPlaceholder("Type a command or search...")).toBeVisible();

    await page.getByPlaceholder("Type a command or search...").fill("create space");
    await page.getByRole("option", { name: "Create Space" }).click();

    const dialog = page.getByRole("dialog").filter({ hasText: "Space Name" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Space Name")).toBeVisible();
  });

  test("Space item appears in palette", async ({ page }) => {
    const createRes = await page.request.post("/api/spaces", {
      data: { name: "Palette Space" },
    });
    expect(createRes.ok()).toBeTruthy();

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await openPalette(page);
    await expect(page.getByPlaceholder("Type a command or search...")).toBeVisible();

    await page.getByPlaceholder("Type a command or search...").fill("palette space");
    await expect(page.getByRole("option", { name: "Palette Space" })).toBeVisible();
  });
});
