import { test, expect } from "@playwright/test";

test.describe.serial("hub", () => {
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

  test("loads with correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/ExcaliHub/);
  });

  test("shows empty state when no spaces", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("main").getByText("No spaces yet")).toBeVisible();
  });

  test("creates a space and appears in list", async ({ page }) => {
    await page.goto("/");

    // Open the create modal
    await page.getByRole("button", { name: "Create Space" }).click();

    // Wait for the dialog to appear
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Fill and submit the form
    await page.getByLabel("Space Name").fill("My Test Space");
    await dialog.getByRole("button", { name: "Create" }).click();

    // Dialog closes
    await expect(dialog).not.toBeVisible();

    // Reload to pick up the new space from the API
    await page.reload();
    await expect(page.getByRole("link", { name: "My Test Space", exact: true })).toBeVisible();
    await expect(page.getByText("my-test-space.")).toBeVisible();
  });

  test("archives and unarchives a space via UI", async ({ page }) => {
    // Create via API
    const createRes = await page.request.post("/api/spaces", {
      data: { name: "Archive Me" },
    });
    expect(createRes.ok()).toBeTruthy();

    // Verify on dashboard
    await page.goto("/");
    await expect(page.getByRole("main").getByText("Archive Me")).toBeVisible();

    // Archive via UI: find the card containing "Archive Me" and click its Archive button
    const card = page.locator('[data-slot="card"]').filter({ hasText: "Archive Me" });
    await card.getByRole("button", { name: "Archive" }).click();

    // Confirm in dialog
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Archive" }).click();

    // Space removed from list
    await expect(page.getByRole("main").getByText("Archive Me")).not.toBeVisible();

    // Go to archived page (no sidebar space entries here)
    await page.getByRole("link", { name: "Archived" }).click();
    await expect(page.getByText("Archive Me")).toBeVisible();

    // Unarchive via UI
    const archivedCard = page.locator('[data-slot="card"]').filter({ hasText: "Archive Me" });
    await archivedCard.getByRole("button", { name: "Unarchive" }).click();

    // Space gone from archived page
    await expect(page.getByText("Archive Me")).not.toBeVisible();

    // Dashboard — space reappears
    await page.getByRole("link", { name: "Spaces" }).click();
    await expect(page.getByRole("main").getByText("Archive Me")).toBeVisible();
  });

  test("deletes a space from archived page via UI", async ({ page }) => {
    // Create and archive via API
    const createRes = await page.request.post("/api/spaces", {
      data: { name: "Delete Me" },
    });
    expect(createRes.ok()).toBeTruthy();
    const space = await createRes.json();

    await page.request.patch(`/api/spaces/${space.id}`, {
      data: { status: "archived" },
    });

    // Go to archived page
    await page.goto("/archived");
    await expect(page.getByText("Delete Me")).toBeVisible();

    // Click delete button on the card
    const card = page.locator('[data-slot="card"]').filter({ hasText: "Delete Me" });
    await card.getByRole("button", { name: "Delete" }).click();

    // Confirm in dialog
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /Permanently delete/ })).toBeVisible();
    await dialog.getByRole("button", { name: "Delete" }).click();

    // Wait for dialog to close, then verify space is gone
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText("Delete Me")).not.toBeVisible();

    // Verify deleted via API
    const getRes = await page.request.get(`/api/spaces/${space.id}`);
    expect(getRes.status()).toBe(404);
  });

  test("toggles theme", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    const themeButton = page.getByTitle(/Theme:/);
    await expect(themeButton).toBeVisible();

    // Click 3 times: system→light→dark→system
    await themeButton.click(); // → light
    await themeButton.click(); // → dark
    const isDark = await html.evaluate((el) => el.classList.contains("dark"));
    expect(isDark).toBe(true);

    await themeButton.click(); // → system
    const finalTitle = await themeButton.getAttribute("title");
    expect(finalTitle).toContain("system");
  });

  test("navigates between pages", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Archived" }).click();
    await expect(page).toHaveURL("/archived");

    await page.getByRole("link", { name: "Spaces" }).click();
    await expect(page).toHaveURL("/");
  });
});
